
export enum AppState {
  Setup = 'Setup',
  Driving = 'Driving'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteConfig {
  start: LocationPoint;
  destination: LocationPoint;
  isSimulating: boolean;
}

export interface WarningState {
  type: 'speed' | 'camera' | 'lane' | 'wrong_way' | null;
  message: string;
  active: boolean;
}

export interface CameraLocation {
  id: string;
  lat: number;
  lng: number;
  type: 'Red Light' | 'Speed';
  address: string;
}

export type GpsQuality = 'seeking' | 'locked' | 'error' | 'simulating';

export interface MapFeature {
  id: string;
  lat: number;
  lng: number;
  type: 'traffic_light' | 'camera';
}
