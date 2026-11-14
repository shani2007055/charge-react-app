export interface Station {
  id: number;
  name: string;
  location: string;
  chargingSpeed: string;
  available: boolean;
}

export interface StationsState {
  items: Station[];
  loading: boolean;
  error: string | null;
}

export const initialState: StationsState = {
  items: [],
  loading: false,
  error: null,
};