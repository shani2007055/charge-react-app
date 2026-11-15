import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/apiClient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout, updateUserName } from '../store/user/userSlice';

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

const subtleLabelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontSize: '0.76rem',
  fontWeight: 600,
  color: '#64748B',
} as const;

export default function UserProfileScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { role } = useAppSelector((state) => state.user);

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // עריכת פרטי משתמש
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  // הוספת רכב חדש
  const [showAddVehicle, setShowAddVehicle] = useState<boolean>(false);
  const [newModel, setNewModel] = useState<string>('');
  const [newCapacityKwh, setNewCapacityKwh] = useState<string>('60');
  const [newCurrentBattery, setNewCurrentBattery] = useState<string>('50');
  const [newChargerType, setNewChargerType] = useState<ChargerType>('CCS');
  const [savingNewVehicle, setSavingNewVehicle] = useState<boolean>(false);

  // עריכת רכב קיים
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [editModel, setEditModel] = useState<string>('');
  const [editCapacityKwh, setEditCapacityKwh] = useState<string>('');
  const [editCurrentBattery, setEditCurrentBattery] = useState<string>('');
  const [editChargerType, setEditChargerType] = useState<ChargerType>('CCS');
  const [savingVehicleEdit, setSavingVehicleEdit] = useState<boolean>(false);

  // אישור מחיקת רכב בלי window.confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadProfileData = async () => {
    setLoading(true);
    setError(null);

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

      setProfile(userProfile);
      setEditName(userProfile.name);
      setEditPhone(userProfile.phone);

      if (userProfile.driverId !== null) {
        const myVehicles = await apiFetch<VehicleDto[]>('/UsersVehicles/my');
        setVehicles(myVehicles);
      } else {
        setVehicles([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfileData();
  }, []);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();

    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setError('השם חייב להכיל בין 2 ל-60 תווים.');
      return;
    }

    if (!ISRAELI_PHONE_REGEX.test(trimmedPhone)) {
      setError('מספר טלפון חייב להיות בפורמט ישראלי תקין (למשל 050-1234567).');
      return;
    }

    setSavingProfile(true);
    setError(null);
    setSuccessMessage(null);

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
      setSuccessMessage('הפרטים האישיים עודכנו בהצלחה!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הפרופיל');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddVehicle = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedModel = newModel.trim();
    const capacity = Number(newCapacityKwh);
    const battery = Number(newCurrentBattery);

    if (trimmedModel.length < 2) {
      setError('דגם הרכב חייב להכיל לפחות 2 תווים.');
      return;
    }
    if (Number.isNaN(capacity) || capacity < 1 || capacity > 300) {
      setError('קיבולת הסוללה חייבת להיות בין 1 ל-300 קוט"ש.');
      return;
    }
    if (Number.isNaN(battery) || battery < 0 || battery > 100) {
      setError('אחוז הסוללה חייב להיות בין 0 ל-100.');
      return;
    }

    setSavingNewVehicle(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const created = await apiFetch<VehicleDto>('/UsersVehicles', {
        method: 'POST',
        body: JSON.stringify({
          model: trimmedModel,
          batteryCapacityKwh: capacity,
          currentBattery: battery,
          supportedChargerType: newChargerType,
        }),
      });

      setVehicles((prev) => [...prev, created]);
      setNewModel('');
      setNewCapacityKwh('60');
      setNewCurrentBattery('50');
      setNewChargerType('CCS');
      setShowAddVehicle(false);
      setSuccessMessage(`הרכב "${created.model}" נוסף בהצלחה!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בהוספת הרכב');
    } finally {
      setSavingNewVehicle(false);
    }
  };

  const startEditVehicle = (vehicle: VehicleDto) => {
    setEditingVehicleId(vehicle.id);
    setEditModel(vehicle.model);
    setEditCapacityKwh(String(vehicle.batteryCapacityKwh));
    setEditCurrentBattery(String(vehicle.currentBattery));
    setEditChargerType(vehicle.supportedChargerType === 'Type2' ? 'Type2' : 'CCS');
    setError(null);
    setSuccessMessage(null);
  };

  const handleSaveVehicleEdit = async (e: FormEvent, vehicleId: number) => {
    e.preventDefault();
    const trimmedModel = editModel.trim();
    const capacity = Number(editCapacityKwh);
    const battery = Number(editCurrentBattery);

    if (trimmedModel.length < 2) {
      setError('דגם הרכב חייב להכיל לפחות 2 תווים.');
      return;
    }
    if (Number.isNaN(capacity) || capacity < 1 || capacity > 300) {
      setError('קיבולת הסוללה חייבת להיות בין 1 ל-300 קוט"ש.');
      return;
    }
    if (Number.isNaN(battery) || battery < 0 || battery > 100) {
      setError('אחוז הסוללה חייב להיות בין 0 ל-100.');
      return;
    }

    setSavingVehicleEdit(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await apiFetch<VehicleDto>(`/UsersVehicles/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          model: trimmedModel,
          batteryCapacityKwh: capacity,
          currentBattery: battery,
          supportedChargerType: editChargerType,
        }),
      });

      setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? updated : v)));
      setEditingVehicleId(null);
      setSuccessMessage('פרטי הרכב עודכנו בהצלחה!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הרכב');
    } finally {
      setSavingVehicleEdit(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: number) => {
    setDeletingId(vehicleId);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiFetch<string>(`/UsersVehicles/${vehicleId}`, {
        method: 'DELETE',
      });
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
      setConfirmDeleteId(null);
      setSuccessMessage('הרכב הוסר מהרשימה.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה במחיקת הרכב');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <div className="container" dir="rtl">
      <div className="screen-view" style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div className="screen-header">
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--ev-text)' }}>
              פרופיל משתמש וניהול רכבים
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--ev-text-muted)' }}>
              עדכון פרטים אישיים ונתוני הסוללה של הרכבים שלך
            </p>
          </div>
          <span className="ev-badge ev-badge-orange">
            {role === 'Owner' ? 'בעל עמדה' : 'נהג'}
          </span>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--ev-text-muted)', padding: '28px' }}>
            טוען פרטי פרופיל...
          </div>
        )}

        {error && (
          <div className="ev-alert ev-alert-error" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div className="ev-alert ev-alert-success" style={{ marginBottom: '16px' }}>
            {successMessage}
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
                  <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--ev-text)' }}>
                    שלום, {profile.name}
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: 'var(--ev-text-muted)', marginTop: '4px' }}>
                    פרופילים משויכים:{' '}
                    {profile.driverId !== null ? 'נהג' : ''}
                    {profile.driverId !== null && profile.ownerId !== null ? ' · ' : ''}
                    {profile.ownerId !== null ? 'בעל עמדות' : ''}
                  </div>
                </div>

                {!isEditingProfile && (
                  <button
                    type="button"
                    className="ev-btn ev-btn-secondary"
                    style={{ width: 'auto', padding: '8px 14px', fontSize: '0.86rem' }}
                    onClick={() => {
                      setEditName(profile.name);
                      setEditPhone(profile.phone);
                      setIsEditingProfile(true);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                  >
                    ערוך פרטים
                  </button>
                )}
              </div>

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
                    <div style={{ fontSize: '0.76rem', color: 'var(--ev-text-muted)' }}>אימייל</div>
                    <div style={{ fontWeight: 600, color: 'var(--ev-text)', marginTop: '2px' }}>
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
                    <div style={{ fontSize: '0.76rem', color: 'var(--ev-text-muted)' }}>טלפון</div>
                    <div
                      className="font-mono-num"
                      style={{ fontWeight: 600, color: 'var(--ev-text)', marginTop: '2px' }}
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
                    <div style={{ fontSize: '0.76rem', color: 'var(--ev-text-muted)' }}>מצב פעיל</div>
                    <div style={{ fontWeight: 600, color: 'var(--ev-accent)', marginTop: '2px' }}>
                      {role === 'Owner' ? 'בעל עמדה' : 'נהג'}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={subtleLabelStyle}>שם מלא</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={subtleLabelStyle}>טלפון (למשל 050-1234567)</label>
                    <input
                      type="tel"
                      className="form-control font-mono-num"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="submit"
                      className="ev-btn ev-btn-primary"
                      style={{ width: 'auto' }}
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'שומר...' : 'שמור שינויים'}
                    </button>
                    <button
                      type="button"
                      className="ev-btn ev-btn-secondary"
                      style={{ width: 'auto' }}
                      onClick={() => setIsEditingProfile(false)}
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
                  <h3 style={{ margin: 0, fontSize: '1.08rem', color: 'var(--ev-text)' }}>
                    הרכבים שלי ({vehicles.length})
                  </h3>
                  <button
                    type="button"
                    className="ev-btn ev-btn-accent"
                    style={{ width: 'auto', padding: '8px 14px', fontSize: '0.86rem' }}
                    onClick={() => {
                      setShowAddVehicle((prev) => !prev);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                  >
                    {showAddVehicle ? 'סגור טופס' : '+ הוסף רכב'}
                  </button>
                </div>

                {showAddVehicle && (
                  <form
                    onSubmit={handleAddVehicle}
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
                        placeholder="למשל Tesla Model 3 / BYD Atto 3"
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        required
                      />
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
                          <option value="CCS">CCS (מהיר)</option>
                          <option value="Type2">Type2 (רגיל)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={subtleLabelStyle}>קיבולת סוללה (kWh)</label>
                        <input
                          type="number"
                          className="form-control font-mono-num"
                          min={1}
                          max={300}
                          value={newCapacityKwh}
                          onChange={(e) => setNewCapacityKwh(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={subtleLabelStyle}>סוללה כעת (%)</label>
                        <input
                          type="number"
                          className="form-control font-mono-num"
                          min={0}
                          max={100}
                          value={newCurrentBattery}
                          onChange={(e) => setNewCurrentBattery(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="ev-btn ev-btn-primary"
                      disabled={savingNewVehicle}
                    >
                      {savingNewVehicle ? 'מוסיף...' : 'שמור רכב חדש'}
                    </button>
                  </form>
                )}

                {vehicles.length === 0 ? (
                  <p style={{ color: 'var(--ev-text-muted)', margin: 0, fontSize: '0.92rem' }}>
                    עדיין לא הוגדר רכב. אפשר להוסיף כאן או שהמערכת תיצור רכב ברירת מחדל בשריון הראשון.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {vehicles.map((vehicle) => (
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
                            style={{ display: 'grid', gap: '12px' }}
                          >
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={subtleLabelStyle}>דגם רכב</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editModel}
                                onChange={(e) => setEditModel(e.target.value)}
                                required
                              />
                            </div>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
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
                                  <option value="CCS">CCS</option>
                                  <option value="Type2">Type2</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={subtleLabelStyle}>קיבולת סוללה (kWh)</label>
                                <input
                                  type="number"
                                  className="form-control font-mono-num"
                                  min={1}
                                  max={300}
                                  value={editCapacityKwh}
                                  onChange={(e) => setEditCapacityKwh(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={subtleLabelStyle}>סוללה נוכחית (%)</label>
                                <input
                                  type="number"
                                  className="form-control font-mono-num"
                                  min={0}
                                  max={100}
                                  value={editCurrentBattery}
                                  onChange={(e) => setEditCurrentBattery(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="submit"
                                className="ev-btn ev-btn-primary"
                                style={{ width: 'auto' }}
                                disabled={savingVehicleEdit}
                              >
                                {savingVehicleEdit ? 'שומר...' : 'שמור'}
                              </button>
                              <button
                                type="button"
                                className="ev-btn ev-btn-secondary"
                                style={{ width: 'auto' }}
                                onClick={() => setEditingVehicleId(null)}
                              >
                                ביטול
                              </button>
                            </div>
                          </form>
                        ) : (
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
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: '1.02rem',
                                  color: 'var(--ev-text)',
                                }}
                              >
                                {vehicle.model}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.86rem',
                                  color: 'var(--ev-text-muted)',
                                  marginTop: '4px',
                                }}
                              >
                                שקע: <strong style={{ color: 'var(--ev-text)' }}>{vehicle.supportedChargerType}</strong>
                                {' · '}קיבולת:{' '}
                                <strong className="font-mono-num" style={{ color: 'var(--ev-text)' }}>
                                  {vehicle.batteryCapacityKwh} kWh
                                </strong>
                                {' · '}סוללה נוכחית:{' '}
                                <strong className="font-mono-num" style={{ color: 'var(--ev-accent)' }}>
                                  {vehicle.currentBattery}%
                                </strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="ev-btn ev-btn-secondary"
                                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
                                onClick={() => startEditVehicle(vehicle)}
                              >
                                ערוך
                              </button>

                              {confirmDeleteId === vehicle.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-danger"
                                    style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
                                    disabled={deletingId === vehicle.id}
                                    onClick={() => void handleDeleteVehicle(vehicle.id)}
                                  >
                                    {deletingId === vehicle.id ? 'מוחק...' : 'אשר מחיקה'}
                                  </button>
                                  <button
                                    type="button"
                                    className="ev-btn ev-btn-secondary"
                                    style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    בטל
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="ev-btn ev-btn-danger"
                                  style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }}
                                  onClick={() => setConfirmDeleteId(vehicle.id)}
                                >
                                  מחק
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* התנתקות */}
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="ev-btn ev-btn-danger"
                style={{ width: 'auto', padding: '10px 20px' }}
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