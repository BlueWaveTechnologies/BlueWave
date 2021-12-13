"""
Author: Sasha Trubetskoy
        sasha@kartographia.com

Date: December 2021

Description: Tool that returns a shipment route given a start and end 
    coordinate.

Usage:
    python py/shipment_route.py -o=98.6722,3.5952 -d=-74.0060,40.7128
    python py/shipment_route.py -o=98.6722,3.5952 -d=-74.0060,40.7128 --entrymode=air

TODO:
    - Take multiple pairs of start and end coordinates
"""
import os
import json
from pathlib import Path
import argparse

import pyproj
import pickle
import numpy as np
import pandas as pd
import networkx as nx
import geopandas as gpd
import matplotlib.pyplot as plt

from itertools import combinations
from geopy import distance
from shapely.geometry import Point, LineString
from sklearn.neighbors import BallTree, KDTree
# from sklearn.neighbors import NearestNeighbors

import time
import logging

# Needed because we will parse command line output
import warnings
warnings.filterwarnings("ignore")


# UTIL
#-------------------------------------------------------------------------------
def get_parent_dir():
    curr_dir = os.path.dirname(os.path.realpath(__file__))
    parent_dir = str(Path(curr_dir).parent)
    return parent_dir


def str_to_tup(lonlat_str):
    """
    '123.45,-144.41' -> (123.45, -144.41)
    """
    try: 
        tup = tuple(float(s) for s in lonlat_str.split(','))
        return tup
    except:
        raise Exception((f'Could not parse lon lat string: {lonlat_str}'
            ' Ensure lon, lat are in correct order and no spaces.'))


def gc_distance(p1, p2):
    """
    (lon, lat)
    Calculate the great circle distance between two points
    on the earth (specified in decimal degrees).
    Returns distance in kilometers.
    """
    lon1, lat1 = p1
    lon2, lat2 = p2
    # convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
    # haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    km = 6367 * c
    return km


def great_circle(origin, destination):
    """
    (lon, lat)
    https://gis.stackexchange.com/questions/47/what-tools-in-python-are-available-for-doing-great-circle-distance-line-creati
    """
    start_lon, start_lat = origin
    end_lon, end_lat = destination

    # calculate distance between points
    g = pyproj.Geod(ellps='WGS84')
    (az12, az21, dist) = g.inv(start_lon, start_lat, end_lon, end_lat)

    # calculate line string along path with segments <= 10 km
    lonlats = g.npts(start_lon, start_lat, end_lon, end_lat,
                     1 + int(dist / 20000))

    # npts doesn't include start/end points, so prepend/append them
    lonlats.insert(0, (start_lon, start_lat))
    lonlats.append((end_lon, end_lat))
    return LineString(lonlats)


def flight_time(origin, destination):
    """
    Notice distances are converted to miles.
    Result is in hours.
    Inputs:
        origin (tuple) - lon, lat
        destination (tuple) - lon, lat
    Source:
        https://math.stackexchange.com/questions/2679808/formula-calculating-airplane-flight-times-from-point-a-to-point-b
    """
    a = 0.117 * gc_distance(origin, destination) / 1.60934
    d_lon = destination[0] - origin[0]
    b = .517 * d_lon
    mins = a + b + 43.2
    return mins / 60


def length_km(geometry):
    # Calculate length in km of lineString
    lons, lats = geometry.xy
    latlons = np.column_stack([lats, lons])
    distance_km = 0
    for a, b in zip(latlons[:-1], latlons[1:]):
        distance_km += distance.distance(a, b).km
    return distance_km


def get_nearest_point(reference_points, input_points):
    """
    For each input point, finds the nearest reference point.
    We use a custom distance function.
    Points are all (x, y) aka (lon, lat)
    """
    ref_in_rads = np.deg2rad(reference_points)
    inp_in_rads = np.deg2rad(input_points)
    ball = BallTree(ref_in_rads, metric='haversine')

    distances, indices = ball.query(inp_in_rads, k=1)
    nearest_points = np.array(reference_points)[indices, :]

    nearest_points = [tuple(*p) for p in nearest_points]
    return nearest_points


# load_or_build_transport_graphs AND HELPERS
#-------------------------------------------------------------------------------
def try_loading_graph(data_dir):
    if os.path.exists(f'{data_dir}/transport_graph.p'):
        logging.info('Found previously calculated transport graph.')
        with open(f'{data_dir}/transport_graph.p', 'rb') as f:
            try:
                G = pickle.load(f)
            except EOFError:
                raise Exception(('Corrupted pickle file. '
                    'Delete "data/transport_graph.p" and try again.'))
        
        assert type(G) == nx.Graph, ('Pickle file contains wrong data'
                    ' and must be regenerated. '
                    'Delete "data/transport_graph.p" and try again.')
        return G


def get_airport_coord_pairs():

    def get_lufthansa_links():
        #   Add Lufthansa connections
        lh1_names = 'RowNr;RD;RA;CD;CA;AL;FNR;SNR;DEP;ARR;STD;DDC;STA;ADC;Mo;Tu;We;Th;Fr;Sa;So;ACtype;ACtypefullname;AG;AGfullname;Start_Op;End_Op'.split(';')
        lh1 = pd.read_csv(datadir + 'air/airline-cargo-schedules/lh1.csv', 
            skiprows=2, names=lh1_names)
        lh1 = lh1.drop([43084])
        lh1_pairs = set(tuple(sorted(row)) for row in lh1[['DEP', 'ARR']].values)
        return lh1_pairs


    def get_american_airlines_links():
        #   Add American Airlines connections
        aa_names = [
            'origin',
            'destination',
            'flight_no',
            'flight_freq',
            'dep_time',
            'arr_time',
            'aircraft_type',
            'subfleet_type',
            'effective_date',
            'discontinue_date',
        ]
        aa1 = pd.read_csv(datadir + 'air/airline-cargo-schedules/aa1.csv',
            names=aa_names, skiprows=6)
        aa1_pairs = set(tuple(sorted(row)) for row in aa1[['origin', 'destination']].dropna().values)
        aa2 = pd.read_csv(datadir + 'air/airline-cargo-schedules/aa2.csv',
            names=aa_names, skiprows=6)
        aa2_pairs = set(tuple(sorted(row)) for row in aa2[['origin', 'destination']].dropna().values)
        return set.union(aa1_pairs, aa2_pairs)

    airports = pd.read_csv(datadir + 'air/airports.csv')
    airports['tup'] = [tuple(row) for row in airports[['lon', 'lat']].values]
    airports = airports.set_index('iata')

    airport_pairs = set()
    airport_pairs = airport_pairs.union(get_lufthansa_links())
    airport_pairs = airport_pairs.union(get_american_airlines_links())

    airport_points = airports['tup'].to_dict()
    airport_points = {k: v for k, v in airport_points.items() if v != (0, 0)}
    coord_pairs = []
    for a, b in airport_pairs:
        tup = (airport_points.get(a, None), airport_points.get(b, None))
        coord_pairs.append(tup)
    return coord_pairs


def add_edge(geometry, G, transport_mode, distance_km=None):
    if not distance_km:
        distance_km = length_km(geometry)
    
    lons, lats = geometry.xy
    start = (round(lons[0], 6), round(lats[0], 6))
    end = (round(lons[-1], 6), round(lats[-1], 6))

    if start[0] == -180:
        start = (180, start[1])
    if end[0] == -180:
        end = (180, end[1])

    # Cost for 24 tonne shipment
    if transport_mode == 'transfer':
        time_hrs = 10
        cost_usd = 10000
    elif transport_mode == 'air':
        time_hrs = flight_time(origin, destination)
        cost_usd = 10 * distance_km
    elif transport_mode == 'road':
        time_hrs = distance_km / 90
        cost_usd = 2.0 * 1.6 * distance_km # $2 per mile
    elif transport_mode == 'rail':
        time_hrs = distance_km / 60
        cost_usd = 0.2 * 1.6 * distance_km # $0.2 per mile
    elif transport_mode == 'sea':
        time_hrs = distance_km / 20
        cost_usd = 0.08 * distance_km
    else:
        raise Exception(f'Unrecognized transport mode: {transport_mode}')

    G.add_edge(start, end, 
        geometry=geometry,
        volume=0,
        mode=transport_mode,
        distance_km=distance_km,
        time_hrs=time_hrs,
        cost_usd=cost_usd,
    )
    return G


def load_or_build_transport_graph():
    parent_dir = get_parent_dir()
    data_dir = parent_dir + os.path.sep + 'data'
    output_dir = parent_dir + os.path.sep + 'output'

    logging.info('Looking for previously calculated transport graph...')
    G = try_loading_graph(data_dir)
    if G:
        logging.info('Loaded previously calculated transport graph.')
        return G

    logging.info(('Could not find previously calculated graphs.'
        'Creating new graph...'))

    G = nx.Graph()

    # Add air, road, rail and sea
    logging.info(f'Adding sea connections...')
    gdf = gpd.read_file(f'{data_dir}/shipping_lanes.geojson')
    for row in gdf.itertuples():
        G = add_edge(row.geometry, G, transport_mode='sea')

    logging.info(f'Adding road connections...')
    gdf = gpd.read_file(f'{data_dir}/major_road/major_road.shp')
    for row in gdf.itertuples():
        G = add_edge(row.geometry, G, transport_mode='road')

    logging.info(f'Adding rail connections...')
    gdf = gpd.read_file(f'{data_dir}/major_rail/major_rail.shp')
    gdf = gdf[gdf['geometry'].notnull()]
    for row in gdf.itertuples():
        G = add_edge(row.geometry, G, transport_mode='rail')

    logging.info(f'Adding air connections...')
    coord_pairs = get_airport_coord_pairs()
    for a, b in coord_pairs:
        if not a or not b:
            continue
        geometry = great_circle(a, b)
        d_gc = gc_distance(a, b)
        G = add_edge(geometry, G, transport_mode='air', distance_km=d_gc)

    # Create links in big cities
    # Approach: take all nodes within 50 km of city and just connect them all
    logging.info(f'Adding major city connections...')
    cities = gpd.read_file(f'{data_dir}/cities.geojson')
    
    nodes_df = pd.DataFrame(list(G.nodes), columns=['lon', 'lat'])
    nodes_df['point'] = [Point(x, y) for x, y in nodes_df.values]
    nodes_gdf = gpd.GeoDataFrame(nodes_df, geometry='point')
    nodes_gdf.crs = 'EPSG:4326'

    cities_buf = cities.geometry.buffer(0.4) # 1 deg = ~100 km
    cities_buf_gdf = gpd.GeoDataFrame(list(range(len(cities))), geometry=cities_buf)
    
    joined = gpd.sjoin(cities_buf_gdf, nodes_gdf)
    
    for city_index, df_i in joined.groupby(joined.index):
        nodes_to_link = df_i[['lon', 'lat']].values
        for a, b in combinations(nodes_to_link, 2):
            if not np.array_equal(a, b):
                geometry = LineString([Point(a), Point(b)])
                G = add_edge(geometry, G, transport_mode='transfer')

    # Add country info to nodes so we know which edges cross country borders
    # (for entrymode)
    logging.info('Adding country information to nodes...')
    nodes_df = pd.DataFrame(list(G.nodes), columns=['lon', 'lat'])
    nodes_df['point'] = [Point(x, y) for x, y in nodes_df.values]
    nodes_gdf = gpd.GeoDataFrame(nodes_df, geometry='point')
    nodes_gdf.crs = 'EPSG:4326'

    countries = gpd.read_file('/Users/sasha/Documents/resources/natural-earth-vector/10m_cultural/ne_10m_admin_0_sovereignty.shp')
    joined = gpd.sjoin(nodes_gdf, countries, how='left')
    joined['NAME'] = joined['NAME'].fillna('None')
    joined['node'] = joined[['lon', 'lat']].apply(tuple, axis=1)
    country_dict = joined.set_index('node')['NAME'].to_dict()
    nx.set_node_attributes(G, country_dict, 'country')

    logging.info(f'Saving transport graph...')
    with open(f'{data_dir}/transport_graph.p', 'wb') as f:
        pickle.dump(G, f)
    logging.info(f'Saved transport network to "{data_dir}/transport_graph.p".')

    return G

# get_entry_mode_subgraph AND HELPERS
#-------------------------------------------------------------------------------
def read_edges_from_json(filename):
    with open(filename, 'r') as f:
        my_edges_json = json.load(f)
    my_edges = []
    for a, b in my_edges_json:
        my_edges.append((tuple(a), tuple(b)))
    return my_edges


def get_subgraph_edges(G, country_entry_mode, dest_country):
    parent_dir = get_parent_dir()
    # Look for cached
    # logging.info(
    #     (f'Looking for cached subgraph edges for entry mode {country_entry_mode}'
    #      f' and destination country {dest_country}.')
    # )
    # filename = f'{parent_dir}/data/cache/{dest_country}-entry-{country_entry_mode}.json'
    # if not os.path.exists(f'{parent_dir}/data/cache'):
    #     os.mkdir(f'{parent_dir}/data/cache')
    # if os.path.exists(filename):
    #     logging.info('Found cached subgraph edges. Loading them...')
    #     my_edges = read_edges_from_json(filename)
    #     return my_edges

    logging.info('Did not find cached subgraph edges. Calculating...')
    my_edges = []
    for a, b in G.edges:
        # One node matches country or other, but not both (XOR)
        is_entering_country = ((G.nodes()[a]['country'] == dest_country)
            != (G.nodes()[b]['country'] == dest_country))
        # Allow transfers in addition to selected mode (prevents glitches)
        is_wrong_mode = G[a][b]['mode'] not in ['transfer', country_entry_mode]
        if is_entering_country and is_wrong_mode:
            continue
        else:
            my_edges.append((a, b))
    # with open(filename, 'w') as f:
    #     json.dump(my_edges, f)
    # logging.info(f'Saved subgraph edges to {filename}.')
    return my_edges


def get_entry_mode_subgraph(G, country_entry_mode, dest_country):
    """
    Get a subgraph of the full transportation graph, where we exclude edges
    crossing into our destination country in the wrong mode. For instance,
    if the user specifies entrymode=sea, we block out all edges entering the 
    destination country that are not sea links.
    """
    my_edges = get_subgraph_edges(G, country_entry_mode, dest_country)
    G2 = G.edge_subgraph(my_edges).copy()
    return G2

# get_entry_mode_subgraph AND HELPERS
#-------------------------------------------------------------------------------
def create_path_gdf(origin, destination, path, G):
    gdf_rows = []

    dist = gc_distance(origin, path[0])
    origin_row = {
        'geometry': LineString([Point(origin), Point(path[0])]),
        'mode': 'road',
        'distance_km': dist,
        'time_hrs': dist / 40,
        'cost_usd': 2.0 * 1.6 * dist # $2 per mile
    }
    gdf_rows.append(origin_row)

    for a, b in zip(path[:-1], path[1:]):
        gdf_rows.append(G[a][b])

    dist = gc_distance(origin, path[0])
    dest_row = {
        'geometry': LineString([Point(path[-1]), Point(destination)]),
        'mode': 'road',
        'distance_km': dist,
        'time_hrs': dist / 40,
        'cost_usd': 2.0 * 1.6 * dist # $2 per mile
    }
    gdf_rows.append(dest_row)

    gdf = gpd.GeoDataFrame(gdf_rows)
    return gdf


def draw_path_and_save(path_gdf):
    parent_dir = get_parent_dir()
    world = gpd.read_file(gpd.datasets.get_path('naturalearth_lowres'))
    fig, ax = plt.subplots(figsize=(16, 8))
    base = world.plot(ax=ax, color='gainsboro', edgecolor='grey')
    path_gdf.plot(ax=ax, column='mode')
    plt.tight_layout()
    plt.savefig(f'{parent_dir}/output/path_{int(time.time())}.png')
    plt.close()


#-------------------------------------------------------------------------------
def main(
    origin,
    destination,
    country_entry_mode=None,
    weight='cost',
    render_path=False,
):
    """
    Inputs:
        origin - (lon, lat) start point
        destination - (lon, lat) end point
        country_entry_mode (str) - Mode in which shipment reached the 
            destination country
        cost (str) - minimize: cost, distance or time?
        render (bool) - whether to render an image of the path
    """    
    parent_dir = get_parent_dir()
    logging.basicConfig(
        filename=f'{parent_dir}/output/messages.log', 
        level=logging.INFO,
        filemode='a',
    )
    logging.info('-'*50)

    logging.info('Building or loading transport graph...')
    G = load_or_build_transport_graph()

    node_origin, node_destination = get_nearest_point(
        reference_points=G.nodes,
        input_points=[origin, destination],
    )
    
    weight = {'cost': 'cost_usd', 'distance': 'distance_km', 'time': 'time_hrs'}[weight]

    try:
        if country_entry_mode:
            if country_entry_mode == 'air':
                weight = 'time_hrs'

            dest_country = G.nodes()[node_destination]['country']
            G2 = get_entry_mode_subgraph(G, country_entry_mode, dest_country)
            path = nx.shortest_path(
                G2, 
                source=node_origin, 
                target=node_destination,
                weight=weight
            )
        else:
            path = nx.shortest_path(
                G, 
                source=node_origin, 
                target=node_destination,
                weight=weight
            )    
    
        path_gdf = create_path_gdf(origin, destination, path, G)

        if render_path:
            draw_path_and_save(path_gdf)

        print(path_gdf.to_json())
        return path_gdf.to_json()
    
    except Exception as e:
        empty = {"type": "FeatureCollection", "features": []}
        print(empty)
        return empty


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '-o',
        '--origin', 
        help='Origin lon, lat', 
        required=True,
    )
    parser.add_argument(
        '-d',
        '--destination', 
        help='Destination lon, lat', 
        required=True,
    )
    parser.add_argument(
        '--entrymode', 
        help='Mode in which shipment reached the US', 
    )
    parser.add_argument(
        '-w',
        '--weight', 
        help='To minimize: "cost", "time", or "distance"',
        default='cost',
    )
    parser.add_argument(
        '-r',
        '--render',
        help='Draw map of path?',
        action='store_true',
    )
    args = parser.parse_args()
    
    origin = str_to_tup(args.origin)
    destination = str_to_tup(args.destination)

    main(
        origin=origin, 
        destination=destination,
        country_entry_mode=args.entrymode,
        weight=args.weight,
        render_path=args.render,
        )
