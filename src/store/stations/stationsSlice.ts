import { createSlice } from '@reduxjs/toolkit';
import { initialState } from './stationsState';
import { fetchStations } from './stationsThunks';

const stationsSlice = createSlice({
  name: 'stations',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // בזמן שליחת הבקשה
      .addCase(fetchStations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      // כשהנתונים הגיעו בהצלחה
      .addCase(fetchStations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      // כשיש שגיאה
      .addCase(fetchStations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error loading stations';
      });
  },
});

export default stationsSlice.reducer;