import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout, updateUserName } from '../store/user/userSlice';
import { setSelectedVehicle } from '../store/stations/stationsSlice';
import PageHeader from './ui/PageHeader';
import { UserRound } from 'lucide-react';
import './ui/DriverDashboard.css';

interface UserClaim {
  type: string;
  value: string;
}

interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  access: string;
  driverId: number | null;
  ownerId: number | null;
}

interface VehicleDto {
  id: number;
  driverId: number;
  model: string;
  batteryCapacityKwh: number;
  currentBattery: number;
  supportedChargerType: string;
}

type ChargerType = 'CCS' | 'Type2';

const ISRAELI_PHONE_REGEX = /^0\d{1,2}-?\d{7}$/;
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

const subtleLabelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '0.76rem',
  fontWeight: 600,
  color: '#64748B',
} as const;

const fieldErrorStyle = {
  fontSize: '0.78rem',
  color: '#B91C1C',
  fontWeight: 600,
  marginTop: '4px',
} as const;

const successBannerStyle = {
  background: '#F0FDF4',
  border: '1px solid #BBF7D0',
  color: '#15803D',
  padding: '10px 14px',
  borderRadius: '10px',
  fontSize: '0.86rem',
  marginBottom: '12px',
} as const;

const eyeButtonStyle = {
  position: 'absolute' as const,
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  padding: '4px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#64748B',
  cursor: 'pointer',
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }

  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function UserProfileScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { role } = useAppSelector((state) => state.user);
  const selectedVehicleId = useAppSelector((state) => state.stations.selectedVehicleId);
  const selectedVehicleIdRef = useRef<number | null>(selectedVehicleId);

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // עריכת פרטי משתמש
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileFieldErrors, setProfileFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // שינוי סיסמה
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [showCurrentPw, setShowCurrentPw] = useState<boolean>(false);
  const [showNewPw, setShowNewPw] = useState<boolean>(false);
  const [showConfirmNewPw, setShowConfirmNewPw] = useState<boolean>(false);
  const [savingPassword, setSavingPassword] = useState<boolean>(false);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<{
    current?: string;
    newPw?: string;
    confirm?: string;
  }>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // הוספת רכב חדש
  const [showAddVehicle, setShowAddVehicle] = useState<boolean>(false);
  const [newModel, setNewModel] = useState<string>('');
  const [newCapacityKwh, setNewCapacityKwh] = useState<string>('60');
  const [newChargerType, setNewChargerType] = useState<ChargerType>('Type2');
  const [savingNewVehicle, setSavingNewVehicle] = useState<boolean>(false);
  const [addVehicleFieldErrors, setAddVehicleFieldErrors] = useState<{
    model?: string;
    capacity?: string;
  }>({});
  const [addVehicleError, setAddVehicleError] = useState<string | null>(null);

  // עריכת רכב קיים
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [editModel, setEditModel] = useState<string>('');
  const [editCapacityKwh, setEditCapacityKwh] = useState<string>('');
  const [editChargerType, setEditChargerType] = useState<ChargerType>('Type2');
  const [savingVehicleEdit, setSavingVehicleEdit] = useState<boolean>(false);
  const [editVehicleFieldErrors, setEditVehicleFieldErrors] = useState<{
    model?: string;
    capacity?: string;
  }>({});
  const [vehicleActionError, setVehicleActionError] = useState<{
    vehicleId: number;
    message: string;
  } | null>(null);
  const [vehiclesSuccess, setVehiclesSuccess] = useState<string | null>(null);

  // אישור מחיקת רכב בלי window.confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const syncSelectedVehicle = (vehicle: VehicleDto | null) => {
    dispatch(setSelectedVehicle(vehicle?.id ?? null));
  };

  useEffect(() => {
    let active = true;

    const loadProfileData = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const claims = await apiFetch<UserClaim[]>('/users/me');
        const userIdClaim = claims.find(
          (c) => c.type === 'nameid' || c.type.endsWith('/nameidentifier')
        );

        if (!userIdClaim) {
          throw new Error('לא נמצא מזהה משתמש בטוקן. נסי להתחבר מחדש.');
        }

        const userId = Number(userIdClaim.value);
        const userProfile = await apiFetch<UserProfileDto>(`/users/${userId}`);

        if (!active) return;
        setProfile(userProfile);
        setEditName(userProfile.name);
        setEditPhone(userProfile.phone);

        if (userProfile.driverId !== null) {
          const myVehicles = await apiFetch<VehicleDto[]>('/UsersVehicles/my');
          if (!active) return;
          setVehicles(myVehicles);

          const currentSelectedId = selectedVehicleIdRef.current;
          if (myVehicles.length === 0) {
            if (currentSelectedId !== null) {
              dispatch(setSelectedVehicle(null));
            }
          } else if (
            currentSelectedId === null ||
            !myVehicles.some((v) => v.id === currentSelectedId)
          ) {
            dispatch(setSelectedVehicle(myVehicles[0].id));
          }
        } else {
          setVehicles([]);
        }
      } catch (err) {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'שגיאה בטעינת הפרופיל');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProfileData();
    return () => {
      active = false;
    };
  }, [dispatch]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();
    const nextFieldErrors: { name?: string; phone?: string } = {};

    if (trimmedName.length < 2 || trimmedName.length > 60) {
      nextFieldErrors.name = 'השם חייב להכיל בין 2 ל-60 תווים.';
    }
    if (!ISRAELI_PHONE_REGEX.test(trimmedPhone)) {
      nextFieldErrors.phone = 'מספר טלפון חייב להיות בפורמט ישראלי תקין (למשל 050-1234567).';
    }

    setProfileFieldErrors(nextFieldErrors);
    setProfileError(null);
    setProfileSuccess(null);

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await apiFetch<UserProfileDto>(`/users/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
        }),
      });

      setProfile(updated);
      dispatch(updateUserName(updated.name));
      setIsEditingProfile(false);
      setProfileSuccess('הפרטים האישיים עודכנו בהצלחה!');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'שגיאה בעדכון הפרופיל');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const nextFieldErrors: { current?: string; newPw?: string; confirm?: string } = {};

    if (!currentPassword) {
      nextFieldErrors.current = 'יש להזין את הסיסמה הנוכחית.';
    }
    if (!newPassword) {
      nextFieldErrors.newPw = 'יש להזין סיסמה חדשה.';
    } else if (!PASSWORD_RULE.test(newPassword)) {
      nextFieldErrors.newPw = 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים, אות באנגלית ומספר.';
    } else if (currentPassword && currentPassword === newPassword) {
      nextFieldErrors.newPw = 'הסיסמה החדשה חייבת להיות שונה מהסיסמה הנוכחית.';
    }

    if (!confirmNewPassword) {
      nextFieldErrors.confirm = 'יש לאמת את הסיסמה החדשה.';
    } else if (newPassword && newPassword !== confirmNewPassword) {
      nextFieldErrors.confirm = 'הסיסמה החדשה ואימות הסיסמה אינם תואמים.';
    }

    setPasswordFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSavingPassword(true);
    try {
      await apiFetch<{ message?: string }>('/users/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmNewPw(false);
      setShowChangePassword(false);
      setPasswordFieldErrors({});
      setPasswordSuccess('הסיסמה עודכנה בהצלחה!');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'שגיאה בשינוי הסיסמה');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAddVehicle = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedModel = newModel.trim();
    const capacity = Number(newCapacityKwh);
    const nextFieldErrors: { model?: string; capacity?: string } = {};

    if (trimmedModel.length < 2) {
      nextFieldErrors.model = 'דגם הרכב חייב להכיל לפחות 2 תווים.';
    }
    if (Number.isNaN(capacity) || capacity < 1 || capacity > 300) {
      nextFieldErrors.capacity = 'קיבולת הסוללה חייבת להיות בין 1 ל-300 קוט"ש.';
    }

    setAddVehicleFieldErrors(nextFieldErrors);
    setAddVehicleError(null);
    setVehiclesSuccess(null);

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSavingNewVehicle(true);
    try {
      const created = await apiFetch<VehicleDto>('/UsersVehicles', {
        method: 'POST',
        body: JSON.stringify({
          model: trimmedModel,
          batteryCapacityKwh: capacity,
          currentBattery: 50,
          supportedChargerType: newChargerType,
        }),
      });

      setVehicles((prev) => [...prev, created]);
      syncSelectedVehicle(created);
      setNewModel('');
      setNewCapacityKwh('60');
      setNewChargerType('Type2');
      setShowAddVehicle(false);
      setAddVehicleFieldErrors({});
      setVehiclesSuccess(`הרכב "${created.model}" נוסף בהצלחה!`);
    } catch (err) {
      setAddVehicleError(err instanceof Error ? err.message : 'שגיאה בהוספת הרכב');
    } finally {
      setSavingNewVehicle(false);
    }
  };

  const startEditVehicle = (vehicle: VehicleDto) => {
    setEditingVehicleId(vehicle.id);
    setEditModel(vehicle.model);
    setEditCapacityKwh(String(vehicle.batteryCapacityKwh));
    setEditChargerType(vehicle.supportedChargerType === 'CCS' ? 'CCS' : 'Type2');
    setEditVehicleFieldErrors({});
    setVehicleActionError(null);
    setVehiclesSuccess(null);
  };

  const handleSaveVehicleEdit = async (e: FormEvent, vehicleId: number) => {
    e.preventDefault();
    const trimmedModel = editModel.trim();
    const capacity = Number(editCapacityKwh);
    const nextFieldErrors: { model?: string; capacity?: string } = {};

    if (trimmedModel.length < 2) {
      nextFieldErrors.model = 'דגם הרכב חייב להכיל לפחות 2 תווים.';
    }
    if (Number.isNaN(capacity) || capacity < 1 || capacity > 300) {
      nextFieldErrors.capacity = 'קיבולת הסוללה חייבת להיות בין 1 ל-300 קוט"ש.';
    }

    setEditVehicleFieldErrors(nextFieldErrors);
    setVehicleActionError(null);
    setVehiclesSuccess(null);

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    const existingVehicle = vehicles.find((v) => v.id === vehicleId);
    setSavingVehicleEdit(true);

    try {
      const updated = await apiFetch<VehicleDto>(`/UsersVehicles/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          model: trimmedModel,
          batteryCapacityKwh: capacity,
          currentBattery: existingVehicle?.currentBattery ?? 50,
          supportedChargerType: editChargerType,
        }),
      });

      const nextVehicles = vehicles.map((v) => (v.id === vehicleId ? updated : v));
      setVehicles(nextVehicles);

      if (
        selectedVehicleId === vehicleId ||
        selectedVehicleId === null ||
        nextVehicles.length === 1
      ) {
        syncSelectedVehicle(updated);
      }

      setEditingVehicleId(null);
      setEditVehicleFieldErrors({});
      setVehiclesSuccess('פרטי הרכב עודכנו בהצלחה!');
    } catch (err) {
      setVehicleActionError({
        vehicleId,
        message: err instanceof Error ? err.message : 'שגיאה בעדכון הרכב',
      });
    } finally {
      setSavingVehicleEdit(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: number) => {
    setDeletingId(vehicleId);
    setVehicleActionError(null);
    setVehiclesSuccess(null);

    try {
      await apiFetch<string>(`/UsersVehicles/${vehicleId}`, {
        method: 'DELETE',
      });
      const remaining = vehicles.filter((v) => v.id !== vehicleId);
      setVehicles(remaining);
      if (selectedVehicleId === vehicleId) {
        syncSelectedVehicle(remaining[0] ?? null);
      }
      setConfirmDeleteId(null);
      setVehiclesSuccess('הרכב הוסר מהרשימה.');
    } catch (err) {
      setVehicleActionError({
        vehicleId,
        message: err instanceof Error ? err.message : 'שגיאה במחיקת הרכב',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <div className="dash-page" dir="rtl">
      <PageHeader
        title="הפרופיל שלי"
        description="ניהול פרטים אישיים, אבטחת החשבון והרכבים שלי"
        icon={UserRound}
        actions={
          <span className="ev-badge ev-badge-brand">
            {role === 'Owner' ? 'בעל עמדה' : 'נהג'}
          </span>
        }
      />

      <div className="driver-profile-content screen-view">
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--ev-ink-muted)', padding: '28px' }}>
            טוען פרטי פרופיל...
          </div>
        )}

        {loadError && (
          <div className="ev-alert-error" style={{ marginBottom: '16px' }}>
            {loadError}
          </div>
        )}

        {!loading && profile && (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* כרטיס פרטים אישיים */}
            <div className="ev-card" style={{ padding: '22px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--ev-ink)' }}>
                    שלום, {profile.name}
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', marginTop: '4px' }}>
                    פרופילים משויכים:{' '}
                    {profile.driverId !== null ? 'נהג' : ''}
                    {profile.driverId !== null && profile.ownerId !== null ? ' · ' : ''}
                    {profile.ownerId !== null ? 'בעל עמדות' : ''}
                  </div>
                </div>

                {!isEditingProfile && (
                  <button
                    type="button"
                    className="ev-btn ev-btn-secondary ev-btn-auto"
                    style={{ padding: '8px 14px', fontSize: '0.86rem' }}
                    onClick={() => {
                      setEditName(profile.name);
                      setEditPhone(profile.phone);
                      setIsEditingProfile(true);
                      setProfileFieldErrors({});
                      setProfileError(null);
                      setProfileSuccess(null);
                    }}
                  >
                    ערוך פרטים
                  </button>
                )}
              </div>

              {profileSuccess && <div style={successBannerStyle}>{profileSuccess}</div>}

              {!isEditingProfile ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid var(--ev-border)',
                      borderRadius: '10px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>אימייל</div>
                    <div style={{ fontWeight: 600, color: 'var(--ev-ink)', marginTop: '2px' }}>
                      {profile.email}
                    </div>
                  </div>
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid var(--ev-border)',
                      borderRadius: '10px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>טלפון</div>
                    <div
                      className="tabular-nums"
                      style={{ fontWeight: 600, color: 'var(--ev-ink)', marginTop: '2px' }}
                    >
                      {profile.phone || 'לא הוזן'}
                    </div>
                  </div>
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid var(--ev-border)',
                      borderRadius: '10px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', color: 'var(--ev-ink-soft)' }}>מצב פעיל</div>
                    <div style={{ fontWeight: 600, color: 'var(--ev-brand)', marginTop: '2px' }}>
                      {role === 'Owner' ? 'בעל עמדה' : 'נהג'}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} noValidate style={{ display: 'grid', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={subtleLabelStyle}>שם מלא</label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ borderColor: profileFieldErrors.name ? '#DC2626' : undefined }}
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        if (profileFieldErrors.name) {
                          setProfileFieldErrors((prev) => ({ ...prev, name: undefined }));
                        }
                      }}
                      required
                    />
                    {profileFieldErrors.name && (
                      <div style={fieldErrorStyle}>{profileFieldErrors.name}</div>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={subtleLabelStyle}>טלפון</label>
                    <input
                      type="text"
                      className="form-control tabular-nums"
                      style={{ borderColor: profileFieldErrors.phone ? '#DC2626' : undefined }}
                      value={editPhone}
                      onChange={(e) => {
                        setEditPhone(e.target.value);
                        if (profileFieldErrors.phone) {
                          setProfileFieldErrors((prev) => ({ ...prev, phone: undefined }));
                        }
                      }}
                      placeholder="050-1234567"
                      required
                    />
                    {profileFieldErrors.phone && (
                      <div style={fieldErrorStyle}>{profileFieldErrors.phone}</div>
                    )}
                  </div>

                  {profileError && (
                    <div className="ev-alert-error" style={{ marginBottom: 0 }}>
                      {profileError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      className="ev-btn ev-btn-auto"
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'שומר...' : 'שמור שינויים'}
                    </button>
                    <button
                      type="button"
                      className="ev-btn ev-btn-secondary ev-btn-auto"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileFieldErrors({});
                        setProfileError(null);
                      }}
                    >
                      ביטול
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* כרטיס אבטחה ושינוי סיסמה */}
            <div className="ev-card" style={{ padding: '22px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginBottom: showChangePassword || passwordSuccess ? '16px' : 0,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', color: 'var(--ev-ink)' }}>
                    אבטחה וסיסמה
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--ev-ink-muted)', marginTop: '3px' }}>
                    עדכון סיסמת ההתחברות לחשבון שלך
                  </div>
                </div>

                <button
                  type="button"
                  className="ev-btn ev-btn-secondary ev-btn-auto"
                  style={{ padding: '8px 14px', fontSize: '0.86rem' }}
                  onClick={() => {
                    setShowChangePassword((prev) => !prev);
                    setPasswordFieldErrors({});
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                >
                  {showChangePassword ? 'סגור' : 'שינוי סיסמה'}
                </button>
              </div>

              {passwordSuccess && <div style={successBannerStyle}>{passwordSuccess}</div>}

              {showChangePassword && (
                <form
                  onSubmit={handleChangePassword}
                  noValidate
                  style={{
                    background: '#F8FAFC',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--ev-border)',
                    display: 'grid',
                    gap: '12px',
                  }}
                >
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={subtleLabelStyle}>סיסמה נוכחית</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="form-control"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          if (passwordFieldErrors.current) {
                            setPasswordFieldErrors((prev) => ({ ...prev, current: undefined }));
                          }
                        }}
                        dir="ltr"
                        style={{
                          textAlign: 'left',
                          paddingRight: '38px',
                          borderColor: passwordFieldErrors.current ? '#DC2626' : undefined,
                        }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw((prev) => !prev)}
                        aria-label={showCurrentPw ? 'הסתר סיסמה' : 'הצג סיסמה'}
                        style={eyeButtonStyle}
                      >
                        <EyeIcon open={showCurrentPw} />
                      </button>
                    </div>
                    {passwordFieldErrors.current && (
                      <div style={fieldErrorStyle}>{passwordFieldErrors.current}</div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={subtleLabelStyle}>
                        סיסמה חדשה (8+ תווים, אות באנגלית ומספר)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          className="form-control"
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (passwordFieldErrors.newPw) {
                              setPasswordFieldErrors((prev) => ({ ...prev, newPw: undefined }));
                            }
                          }}
                          dir="ltr"
                          style={{
                            textAlign: 'left',
                            paddingRight: '38px',
                            borderColor: passwordFieldErrors.newPw ? '#DC2626' : undefined,
                          }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw((prev) => !prev)}
                          aria-label={showNewPw ? 'הסתר סיסמה' : 'הצג סיסמה'}
                          style={eyeButtonStyle}
                        >
                          <EyeIcon open={showNewPw} />
                        </button>
                      </div>
                      {passwordFieldErrors.newPw && (
                        <div style={fieldErrorStyle}>{passwordFieldErrors.newPw}</div>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={subtleLabelStyle}>אימות סיסמה חדשה</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirmNewPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          className="form-control"
                          value={confirmNewPassword}
                          onChange={(e) => {
                            setConfirmNewPassword(e.target.value);
                            if (passwordFieldErrors.confirm) {
                              setPasswordFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                            }
                          }}
                          dir="ltr"
                          style={{
                            textAlign: 'left',
                            paddingRight: '38px',
                            borderColor: passwordFieldErrors.confirm ? '#DC2626' : undefined,
                          }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmNewPw((prev) => !prev)}
                          aria-label={showConfirmNewPw ? 'הסתר סיסמה' : 'הצג סיסמה'}
                          style={eyeButtonStyle}
                        >
                          <EyeIcon open={showConfirmNewPw} />
                        </button>
                      </div>
                      {passwordFieldErrors.confirm && (
                        <div style={fieldErrorStyle}>{passwordFieldErrors.confirm}</div>
                      )}
                    </div>
                  </div>

                  {passwordError && (
                    <div className="ev-alert-error" style={{ marginBottom: 0 }}>
                      {passwordError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      className="ev-btn ev-btn-auto"
                      disabled={savingPassword}
                    >
                      {savingPassword ? 'מעדכן סיסמה...' : 'שמור סיסמה חדשה'}
                    </button>
                    <button
                      type="button"
                      className="ev-btn ev-btn-secondary ev-btn-auto"
                      onClick={() => {
                        setShowChangePassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                        setPasswordFieldErrors({});
                        setPasswordError(null);
                      }}
                    >
                      ביטול
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* כרטיס ניהול רכבים (לנהגים) */}
            {profile.driverId !== null && (
              <div className="ev-card" style={{ padding: '22px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '1.08rem', color: 'var(--ev-ink)' }}>
                    הרכבים שלי ({vehicles.length})
                  </h3>
                  <button
                    type="button"
                    className="ev-btn ev-btn-accent ev-btn-auto"
                    style={{ padding: '8px 14px', fontSize: '0.86rem' }}
                    onClick={() => {
                      setShowAddVehicle((prev) => !prev);
                      setAddVehicleFieldErrors({});
                      setAddVehicleError(null);
                      setVehiclesSuccess(null);
                    }}
                  >
                    {showAddVehicle ? 'סגור טופס' : '+ הוסף רכב'}
                  </button>
                </div>

                {vehiclesSuccess && <div style={successBannerStyle}>{vehiclesSuccess}</div>}

                {showAddVehicle && (
                  <form
                    onSubmit={handleAddVehicle}
                    noValidate
                    style={{
                      background: '#F8FAFC',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid var(--ev-border)',
                      marginBottom: '16px',
                      display: 'grid',
                      gap: '12px',
                    }}
                  >
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={subtleLabelStyle}>דגם רכב</label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ borderColor: addVehicleFieldErrors.model ? '#DC2626' : undefined }}
                        placeholder="למשל Tesla Model 3 / BYD Atto 3"
                        value={newModel}
                        onChange={(e) => {
                          setNewModel(e.target.value);
                          if (addVehicleFieldErrors.model) {
                            setAddVehicleFieldErrors((prev) => ({ ...prev, model: undefined }));
                          }
                        }}
                        required
                      />
                      {addVehicleFieldErrors.model && (
                        <div style={fieldErrorStyle}>{addVehicleFieldErrors.model}</div>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={subtleLabelStyle}>סוג שקע</label>
                        <select
                          className="form-control"
                          value={newChargerType}
                          onChange={(e) => setNewChargerType(e.target.value as ChargerType)}
                        >
                          <option value="Type2">Type2 (רגיל)</option>
                          <option value="CCS">CCS (מהיר)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={subtleLabelStyle}>קיבולת סוללה (kWh)</label>
                        <input
                          type="number"
                          className="form-control tabular-nums"
                          style={{
                            borderColor: addVehicleFieldErrors.capacity ? '#DC2626' : undefined,
                          }}
                          min={1}
                          max={300}
                          value={newCapacityKwh}
                          onChange={(e) => {
                            setNewCapacityKwh(e.target.value);
                            if (addVehicleFieldErrors.capacity) {
                              setAddVehicleFieldErrors((prev) => ({
                                ...prev,
                                capacity: undefined,
                              }));
                            }
                          }}
                          required
                        />
                        {addVehicleFieldErrors.capacity && (
                          <div style={fieldErrorStyle}>{addVehicleFieldErrors.capacity}</div>
                        )}
                      </div>
                    </div>

                    {addVehicleError && (
                      <div className="ev-alert-error" style={{ marginBottom: 0 }}>
                        {addVehicleError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="ev-btn"
                      disabled={savingNewVehicle}
                    >
                      {savingNewVehicle ? 'מוסיף...' : 'שמור רכב חדש'}
                    </button>
                  </form>
                )}

                {vehicles.length === 0 ? (
                  <p style={{ color: 'var(--ev-ink-muted)', margin: 0, fontSize: '0.92rem' }}>
                    עדיין לא הוגדר רכב. אפשר להוסיף כאן או שהמערכת תיצור רכב ברירת מחדל בשריון הראשון.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {vehicles.map((vehicle) => {
                      const rowError =
                        vehicleActionError?.vehicleId === vehicle.id
                          ? vehicleActionError.message
                          : null;

                      return (
                        <div
                          key={vehicle.id}
                          style={{
                            background: '#FFFFFF',
                            padding: '15px',
                            borderRadius: '12px',
                            border: '1px solid var(--ev-border)',
                          }}
                        >
                          {editingVehicleId === vehicle.id ? (
                            <form
                              onSubmit={(e) => void handleSaveVehicleEdit(e, vehicle.id)}
                              noValidate
                              style={{ display: 'grid', gap: '12px' }}
                            >
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={subtleLabelStyle}>דגם רכב</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{
                                    borderColor: editVehicleFieldErrors.model ? '#DC2626' : undefined,
                                  }}
                                  value={editModel}
                                  onChange={(e) => {
                                    setEditModel(e.target.value);
                                    if (editVehicleFieldErrors.model) {
                                      setEditVehicleFieldErrors((prev) => ({
                                        ...prev,
                                        model: undefined,
                                      }));
                                    }
                                  }}
                                  required
                                />
                                {editVehicleFieldErrors.model && (
                                  <div style={fieldErrorStyle}>{editVehicleFieldErrors.model}</div>
                                )}
                              </div>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                  gap: '10px',
                                }}
                              >
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label style={subtleLabelStyle}>סוג שקע</label>
                                  <select
                                    className="form-control"
                                    value={editChargerType}
                                    onChange={(e) =>
                                      setEditChargerType(e.target.value as ChargerType)
                                    }
                                  >
                                    <option value="Type2">Type2</option>
                                    <option value="CCS">CCS</option>
                                  </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                  <label style={subtleLabelStyle}>קיבולת סוללה (kWh)</label>
                                  <input
                                    type="number"
                                    className="form-control tabular-nums"
                                    style={{
                                      borderColor: editVehicleFieldErrors.capacity
                                        ? '#DC2626'
                                        : undefined,
                                    }}
                                    min={1}
                                    max={300}
                                    value={editCapacityKwh}
                                    onChange={(e) => {
                                      setEditCapacityKwh(e.target.value);
                                      if (editVehicleFieldErrors.capacity) {
                                        setEditVehicleFieldErrors((prev) => ({
                                          ...prev,
                                          capacity: undefined,
                                        }));
                                      }
                                    }}
                                    required
                                  />
                                  {editVehicleFieldErrors.capacity && (
                                    <div style={fieldErrorStyle}>
                                      {editVehicleFieldErrors.capacity}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {rowError && (
                                <div className="ev-alert-error" style={{ marginBottom: 0 }}>
                                  {rowError}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="submit"
                                  className="ev-btn ev-btn-auto"
                                  disabled={savingVehicleEdit}
                                >
                                  {savingVehicleEdit ? 'שומר...' : 'שמור'}
                                </button>
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-secondary ev-btn-auto"
                                  onClick={() => {
                                    setEditingVehicleId(null);
                                    setEditVehicleFieldErrors({});
                                    setVehicleActionError(null);
                                  }}
                                >
                                  ביטול
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '10px',
                                }}
                              >
                                <div>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '1.02rem',
                                      color: 'var(--ev-ink)',
                                    }}
                                  >
                                    {vehicle.model}
                                  </span>
                                  <div
                                    style={{
                                      fontSize: '0.86rem',
                                      color: 'var(--ev-ink-muted)',
                                      marginTop: '4px',
                                    }}
                                  >
                                    שקע:{' '}
                                    <strong style={{ color: 'var(--ev-ink)' }}>
                                      {vehicle.supportedChargerType}
                                    </strong>
                                    {' · '}קיבולת:{' '}
                                    <strong className="tabular-nums" style={{ color: 'var(--ev-ink)' }}>
                                      {vehicle.batteryCapacityKwh} kWh
                                    </strong>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-secondary ev-btn-auto"
                                    style={{ padding: '6px 12px', fontSize: '0.84rem' }}
                                    onClick={() => startEditVehicle(vehicle)}
                                  >
                                    ערוך
                                  </button>

                                  {confirmDeleteId === vehicle.id ? (
                                    <>
                                      <button
                                        type="button"
                                        className="ev-btn ev-btn-danger ev-btn-auto"
                                        style={{ padding: '6px 12px', fontSize: '0.84rem' }}
                                        disabled={deletingId === vehicle.id}
                                        onClick={() => void handleDeleteVehicle(vehicle.id)}
                                      >
                                        {deletingId === vehicle.id ? 'מוחק...' : 'אשר מחיקה'}
                                      </button>
                                      <button
                                        type="button"
                                        className="ev-btn ev-btn-secondary ev-btn-auto"
                                        style={{ padding: '6px 12px', fontSize: '0.84rem' }}
                                        onClick={() => setConfirmDeleteId(null)}
                                      >
                                        בטל
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="ev-btn ev-btn-danger ev-btn-auto"
                                      style={{ padding: '6px 12px', fontSize: '0.84rem' }}
                                      onClick={() => setConfirmDeleteId(vehicle.id)}
                                    >
                                      מחק
                                    </button>
                                  )}
                                </div>
                              </div>

                              {rowError && (
                                <div className="ev-alert-error" style={{ marginTop: '10px', marginBottom: 0 }}>
                                  {rowError}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* התנתקות */}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="ev-btn ev-btn-danger ev-btn-auto"
                style={{ padding: '10px 20px' }}
                onClick={handleLogout}
              >
                התנתק מהמערכת
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}