import { createSlice } from '@reduxjs/toolkit';
import { initialState } from './userState';
import { setCarModelReducer, addCommunityPointsReducer } from './userReducers';

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setCarModel: setCarModelReducer,
    addCommunityPoints: addCommunityPointsReducer,
  },
});

export const { setCarModel, addCommunityPoints } = userSlice.actions;
export default userSlice.reducer;