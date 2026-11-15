
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { initialState } from './userState';

import {
  setCarModelReducer,
  addCommunityPointsReducer
} from './userReducers';

import {
  loginUser,
  registerUser,
  switchUserRole,
  type AuthSuccessResult
} from './userThunks';

const saveSession = (
  id: number | null,
  name: string,
  email: string,
  role: string
) => {
  localStorage.setItem(
    'user_session',
    JSON.stringify({ id, name, email, role })
  );
};

const clearUserFields = (state: typeof initialState) => {
  state.id = null;
  state.name = 'אורח';
  state.email = '';
  state.role = 'Driver';
  state.token = null;
  state.error = null;
  state.loading = false;

  localStorage.removeItem('token');
  localStorage.removeItem('user_session');
};

const pending = (state: typeof initialState) => {
  state.loading = true;
  state.error = null;
  state.sessionExpiredMessage = null;
};

const fulfilled = (
  state: typeof initialState,
  action: PayloadAction<AuthSuccessResult>
) => {
  state.loading = false;
  state.id = action.payload.id;
  state.name = action.payload.name;
  state.email = action.payload.email;
  state.role = action.payload.role;
  state.token = action.payload.token;
  state.error = null;
  state.sessionExpiredMessage = null;

  saveSession(
    state.id,
    state.name,
    state.email,
    state.role
  );
};

const userSlice = createSlice({
  name: 'user',
  initialState,

  reducers: {
    setCarModel: setCarModelReducer,

    addCommunityPoints: addCommunityPointsReducer,

    updateUserName: (
      state,
      action: PayloadAction<string>
    ) => {
      state.name = action.payload;

      saveSession(
        state.id,
        state.name,
        state.email,
        state.role
      );
    },

    logout: state => {
      clearUserFields(state);
      state.sessionExpiredMessage = null;
    },

    expireSession: state => {
      clearUserFields(state);
      state.sessionExpiredMessage =
        'פג תוקף ההתחברות. יש להתחבר מחדש.';
    },

    clearSessionExpiredMessage: state => {
      state.sessionExpiredMessage = null;
    }
  },

  extraReducers: builder => {
    builder

      .addCase(loginUser.pending, pending)
      .addCase(loginUser.fulfilled, fulfilled)
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message ?? 'שגיאה בהתחברות';
      })

      .addCase(registerUser.pending, pending)
      .addCase(registerUser.fulfilled, fulfilled)
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message ?? 'שגיאה בהרשמה';
      })

      .addCase(switchUserRole.pending, pending)
      .addCase(switchUserRole.fulfilled, fulfilled)
      .addCase(switchUserRole.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message ?? 'שגיאה במעבר פרופיל';
      });
  }
});

export const {
  setCarModel,
  addCommunityPoints,
  updateUserName,
  logout,
  expireSession,
  clearSessionExpiredMessage
} = userSlice.actions;

export default userSlice.reducer;
