import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { initialState } from './userState';
import { setCarModelReducer, addCommunityPointsReducer } from './userReducers';
import { loginUser, registerUser } from './userThunks';

const saveSession = (id: number | null, name: string, email: string, role: string) => {
  localStorage.setItem('user_session', JSON.stringify({ id, name, email, role }));
};

const clearUserFields = (state: typeof initialState) => {
  state.id = null;
  state.name = 'אורח';
  state.email = '';
  state.role = 'Driver';
  state.token = null;
  state.error = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user_session');
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setCarModel: setCarModelReducer,
    addCommunityPoints: addCommunityPointsReducer,
    updateUserName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
      saveSession(state.id, state.name, state.email, state.role);
    },
    logout: (state) => {
      clearUserFields(state);
      state.sessionExpiredMessage = null;
    },
    expireSession: (state) => {
      clearUserFields(state);
      state.sessionExpiredMessage = 'פג תוקף ההתחברות למערכת. יש להתחבר מחדש כדי להמשיך.';
    },
    clearSessionExpiredMessage: (state) => {
      state.sessionExpiredMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // התחברות
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.sessionExpiredMessage = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.id = action.payload.id;
        state.name = action.payload.name;
        state.email = action.payload.email;
        state.role = action.payload.role;
        state.token = action.payload.token;
        state.sessionExpiredMessage = null;
        saveSession(action.payload.id, action.payload.name, action.payload.email, action.payload.role);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'שגיאה בהתחברות';
      })
      // הרשמה
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.sessionExpiredMessage = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.id = action.payload.id;
        state.name = action.payload.name;
        state.email = action.payload.email;
        state.role = action.payload.role;
        state.token = action.payload.token;
        state.sessionExpiredMessage = null;
        saveSession(action.payload.id, action.payload.name, action.payload.email, action.payload.role);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'שגיאה בהרשמה';
      });
  },
});

export const {
  setCarModel,
  addCommunityPoints,
  updateUserName,
  logout,
  expireSession,
  clearSessionExpiredMessage,
} = userSlice.actions;

export default userSlice.reducer;