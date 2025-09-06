export function rowsToFeatureCollection(rows) {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      properties: {
        title: r.title,
        link_url: r.link_url,
        source_type: r.source_type,
        address: r.address,
        tags: r.tags,
        category: r.category,
        distance_m: r.distance_m ?? undefined,
      },
      geometry: r.geojson,
    })),
  };
}
