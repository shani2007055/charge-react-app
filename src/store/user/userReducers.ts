import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserState } from './userState';

export const setCarModelReducer = (state: UserState, action: PayloadAction<string>) => {
  state.carModel = action.payload;
};

export const addCommunityPointsReducer = (state: UserState, action: PayloadAction<number>) => {
  state.communityPoints += action.payload;
};