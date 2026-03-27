import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import axonLogo from '@/assets/axon-logo.png';
import {
  LogOut, Users, Activity, HardDrive, Trash2, Plus, Shield,
  UserCheck, UserX, AlertTriangle, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Profile {
  id: string;
  username: string;
  role: string;
  is_active: boolean | null;
  created_at: string | null;
  connection_count?: number;
}

const AdminPanel = () => {
  const { user, logout } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState({ totalStaff: 0, totalConnections: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const fetchData = async () => {
    const { data: profs } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { count: connCount } = await supabase.from('tracking_logs').select('*', { count: 'exact', head: true });

    if (profs) {
      // Get connection counts per user
      const profilesWithCounts = await Promise.all(
        profs.map(async (p) => {
          const { count } = await supabase
            .from('tracking_logs')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', p.id);
          return { ...p, connection_count: count ?? 0 };
        })
      );
      setProfiles(profilesWithCounts);
      setStats({
        totalStaff: profs.filter((p) => p.is_active).length,
        totalConnections: connCount ?? 0,
      });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleUserStatus = async (profile: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !profile.is_active })
      .eq('id', profile.id);
    if (!error) {
      toast.success(`Akun ${profile.username} ${profile.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`);
      fetchData();
    }
  };

  const deleteUser = async (profile: Profile) => {
    if (profile.id === user?.id) {
      toast.error('Tidak dapat menghapus akun sendiri.');
      return;
    }
    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
    if (!error) {
      toast.success(`Akun ${profile.username} dihapus.`);
      fetchData();
    }
  };

  const cleanupOldPhotos = async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: oldLogs } = await supabase
      .from('tracking_logs')
      .select('id, photo_url')
      .lt('created_at', cutoff)
      .not('photo_url', 'is', null);

    if (oldLogs && oldLogs.length > 0) {
      const filePaths = oldLogs
        .map((l) => {
          if (!l.photo_url) return null;
          const parts = l.photo_url.split('/verification-photos/');
          return parts[1] || null;
        })
        .filter(Boolean) as string[];

      if (filePaths.length > 0) {
        await supabase.storage.from('verification-photos').remove(filePaths);
      }
      // Clear photo URLs
      for (const log of oldLogs) {
        await supabase.from('tracking_logs').delete().eq('id', log.id);
      }
      toast.success(`${oldLogs.length} foto lama dihapus.`);
    } else {
      toast.info('Tidak ada foto yang lebih dari 24 jam.');
    }
    setShowCleanupConfirm(false);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={axonLogo} alt="Axon" className="h-8" />
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">ADMIN</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/'}>
              Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={<Users className="w-5 h-5 text-primary" />} label="Staf Aktif" value={stats.totalStaff} />
          <StatCard icon={<Activity className="w-5 h-5 text-accent" />} label="Total Koneksi" value={stats.totalConnections} />
          <StatCard icon={<HardDrive className="w-5 h-5 text-muted-foreground" />} label="Log Perangkat" value={stats.totalConnections} />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Buat Akun Staf
          </Button>
          <Button variant="destructive" onClick={() => setShowCleanupConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-1" /> Bersihkan Foto {'>'} 24 Jam
          </Button>
        </div>

        {/* User Table */}
        <div className="axon-card overflow-x-auto">
          <h2 className="axon-heading text-lg mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Manajemen Pengguna
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-muted-foreground">Username</th>
                <th className="pb-3 font-medium text-muted-foreground">Peran</th>
                <th className="pb-3 font-medium text-muted-foreground hidden sm:table-cell">Dibuat</th>
                <th className="pb-3 font-medium text-muted-foreground">Koneksi</th>
                <th className="pb-3 font-medium text-muted-foreground">Status</th>
                <th className="pb-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 font-medium text-foreground">{p.username}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {p.role}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground hidden sm:table-cell">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="py-3 text-muted-foreground">{p.connection_count ?? 0}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.is_active ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {p.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUserStatus(p)}
                        title={p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {p.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                      {p.id !== user?.id && (
                        <Button variant="ghost" size="sm" onClick={() => deleteUser(p)} title="Hapus">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create User Modal */}
      {showCreateModal && <CreateUserModal onClose={() => { setShowCreateModal(false); fetchData(); }} />}

      {/* Cleanup Confirm */}
      {showCleanupConfirm && (
        <ConfirmDialog
          title="Bersihkan Foto Verifikasi"
          message="Apakah Anda yakin ingin menghapus semua foto verifikasi yang berusia lebih dari 24 jam? Aksi ini tidak dapat dibatalkan."
          onConfirm={cleanupOldPhotos}
          onCancel={() => setShowCleanupConfirm(false)}
        />
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="axon-card flex items-center gap-4">
    <div className="p-3 rounded-xl bg-secondary">{icon}</div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  </div>
);

const CreateUserModal = ({ onClose }: { onClose: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('profiles').insert({
      username: username.trim(),
      password: password,
      role,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Username sudah digunakan.' : error.message);
    } else {
      toast.success('Akun berhasil dibuat!');
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="axon-card w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <h3 className="axon-heading text-lg mb-4">Buat Akun Staf Baru</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username_baru" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Peran</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full mt-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="user">User (Staf)</option>
              <option value="owner">Owner (Admin)</option>
            </select>
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? 'Membuat...' : 'Buat Akun'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ConfirmDialog = ({
  title, message, onConfirm, onCancel,
}: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
    <div className="axon-card w-full max-w-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-full bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <h3 className="axon-heading text-lg">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{message}</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">Batal</Button>
        <Button variant="destructive" onClick={onConfirm} className="flex-1">Hapus</Button>
      </div>
    </div>
  </div>
);

export default AdminPanel;
