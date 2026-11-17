import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit';

import {
  initialState,
  type DriverCoords,
  type DestinationPoint
} from './stationsState';

import {
  fetchStations,
  recommendStations,
  recommendRoute
} from './stationsThunks';

import {
  logout,
  expireSession
} from '../user/userSlice';

const stationsSlice = createSlice({
  name: 'stations',
  initialState,

  reducers: {

    clearSearch: (state) => {
      state.hasSearched = false;
      state.recommendations = [];
      state.routeResult = null;
    },

    setDestination: (
      state,
      action: PayloadAction<DestinationPoint | null>
    ) => {
      state.destination = action.payload;
    },

    setSelectedVehicle: (
      state,
      action: PayloadAction<number | null>
    ) => {
      state.selectedVehicleId = action.payload;
    },

    setSearchBattery: (
      state,
      action: PayloadAction<{
        currentBatteryPercent: number;
        targetBatteryPercent: number;
      }>
    ) => {
      state.currentBatteryPercent =
        action.payload.currentBatteryPercent;

      state.targetBatteryPercent =
        action.payload.targetBatteryPercent;
    },

    setDriverLocation: (
      state,
      action: PayloadAction<DriverCoords | null>
    ) => {
      state.driverLocation = action.payload;
    }
  },

  extraReducers: (builder) => {
    builder

      .addCase(logout, () => initialState)

      .addCase(expireSession, () => initialState)

      .addCase(fetchStations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchStations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.hasSearched = false;
      })

      .addCase(fetchStations.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message ??
          'שגיאה בטעינת העמדות';
      })

      .addCase(recommendStations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(recommendStations.fulfilled, (state, action) => {
        state.loading = false;
        state.recommendations = action.payload;
        state.routeResult = null;          // חיפוש רגיל – מוחקים תוצאת מסלול קודמת
        state.hasSearched = true;
      })

      .addCase(recommendStations.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message ??
          'שגיאה בהפעלת אלגוריתם ההמלצות';
      })

      // === מצב מסלול ===
      .addCase(recommendRoute.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(recommendRoute.fulfilled, (state, action) => {
        state.loading = false;
        state.routeResult = action.payload;                 // כל התשובה (כולל "אין צורך בטעינה")
        state.recommendations = action.payload.stations;    // אותה רשימה שהמסך כבר יודע להציג
        state.hasSearched = true;
      })

      .addCase(recommendRoute.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message ??
          'שגיאה בחישוב עצירה בדרך';
      });
  }
});

export const {
  clearSearch,
  setSearchBattery,
  setDriverLocation,
  setSelectedVehicle,
  setDestination
} = stationsSlice.actions;

export default stationsSlice.reducer;