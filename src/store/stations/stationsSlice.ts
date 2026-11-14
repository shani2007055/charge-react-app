import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { initialState } from './stationsState';
import { fetchStations, recommendStations } from './stationsThunks';

const stationsSlice = createSlice({
  name: 'stations',
  initialState,
  reducers: {
    clearSearch: (state) => {
      state.hasSearched = false;
      state.recommendations = [];
    },
    setSearchBattery: (
      state,
      action: PayloadAction<{ currentBatteryPercent: number; targetBatteryPercent: number }>
    ) => {
      state.currentBatteryPercent = action.payload.currentBatteryPercent;
      state.targetBatteryPercent = action.payload.targetBatteryPercent;
    },
  },
  extraReducers: (builder) => {
    builder
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
        state.error = action.error.message ?? 'שגיאה בטעינת העמדות';
      })
      .addCase(recommendStations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(recommendStations.fulfilled, (state, action) => {
        state.loading = false;
        state.recommendations = action.payload;
        state.hasSearched = true;
      })
      .addCase(recommendStations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'שגיאה בהפעלת אלגוריתם ההמלצות';
      });
  },
});

export const { clearSearch, setSearchBattery } = stationsSlice.actions;
export default stationsSlice.reducer;