package bluewave.utils;

import javaxt.json.JSONArray;
import javaxt.json.JSONObject;

public class SearchResults {

    private JSONArray resultList = new JSONArray();
    private long hits;

    public SearchResults(long hits) {
        this.hits = hits;
    }

    public JSONArray getResultList() {
        return resultList;
    }

    public long getHits() {
        return hits;
    }

    public void add(JSONObject hit) {
        resultList.add(hit);
    }

}
