export interface Vehicle {
  id: number;
  driverId: number;
  model: string;
  batteryCapacityKwh: number;
  currentBattery: number;
  supportedChargerType: string;
}