package bluewave.utils;
import java.util.*;
import org.locationtech.jts.geom.*;

public class JTS {

    private static PrecisionModel precisionModel = new PrecisionModel();
    private static GeometryFactory geometryFactory = new GeometryFactory(precisionModel, 4326);

    private JTS(){}

    public static Point createPoint(double lat, double lon){
        return geometryFactory.createPoint(new Coordinate(lon, lat));
    }

    public static Polygon createPolygon(ArrayList<Coordinate> coordinates){
        return geometryFactory.createPolygon(coordinates.toArray(new Coordinate[coordinates.size()]));
    }

    public static MultiPolygon createMultiPolygon(ArrayList<Polygon> polygons){
        return geometryFactory.createMultiPolygon(polygons.toArray(new Polygon[polygons.size()]));
    }

}