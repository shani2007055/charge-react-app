import { configureStore } from '@reduxjs/toolkit';
import userReducer from './user/userSlice';
import stationsReducer from './stations/stationsSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    stations: stationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;