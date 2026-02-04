import { CameraLocation } from './types';

export const MOCK_CAMERAS: CameraLocation[] = [
  { id: 'cam1', lat: 10.7769, lng: 106.7009, type: 'Red Light', address: 'Ngã tư Lê Lợi - Pasteur' },
  { id: 'cam2', lat: 10.7798, lng: 106.6990, type: 'Speed', address: 'Đường Nguyễn Thị Minh Khai' },
  { id: 'cam3', lat: 10.7725, lng: 106.6980, type: 'Red Light', address: 'Chợ Bến Thành' },
];

export const MAX_SPEED_LIMIT = 50; // km/h (Default city limit)
export const WARNING_DISTANCE_METERS = 200;

// Used to simulate movement if GPS is static (for demo purposes)
export const DEMO_ROUTE_POINTS = [
  { lat: 10.7760, lng: 106.7000 },
  { lat: 10.7770, lng: 106.7010 },
  { lat: 10.7780, lng: 106.7020 },
  { lat: 10.7790, lng: 106.7030 },
];
