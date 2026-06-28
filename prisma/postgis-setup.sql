-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Trigger function: auto-generate geom from latitude + longitude
CREATE OR REPLACE FUNCTION update_geom_from_latlon()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for riwayat_sinyal
CREATE TRIGGER trg_riwayat_sinyal_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON riwayat_sinyal
  FOR EACH ROW
  EXECUTE FUNCTION update_geom_from_latlon();

-- Trigger for tower
CREATE TRIGGER trg_tower_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON tower
  FOR EACH ROW
  EXECUTE FUNCTION update_geom_from_latlon();

-- Spatial index for riwayat_sinyal
CREATE INDEX IF NOT EXISTS idx_riwayat_sinyal_geom ON riwayat_sinyal USING GIST (geom);

-- Spatial index for tower
CREATE INDEX IF NOT EXISTS idx_tower_geom ON tower USING GIST (geom);
