import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import axonLogo from '@/assets/axon-logo.png';
import {
  LogOut, Link2, Copy, Check, MapPin, Battery, Wifi, Clock,
  Smartphone, Gauge, Image, Download, ChevronDown, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const DING_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

interface TrackingLog {
  id: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  battery_level: number | null;
  is_charging: boolean | null;
  ip_address: string | null;
  isp_provider: string | null;
  device_info: Record<string, string> | null;
  photo_url: string | null;
  created_at: string | null;
}

const UserDashboard = () => {
  const { user, logout } = useAuth();
  const [logs, setLogs] = useState<TrackingLog[]>([]);
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [latestLink, setLatestLink] = useState('');
  const [activeTab, setActiveTab] = useState<'devices' | 'photos'>('devices');

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tracking_logs')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    if (data) setLogs(data as unknown as TrackingLog[]);
  }, [user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('tracking-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tracking_logs', filter: `created_by=eq.${user.id}` },
        (payload) => {
          const newLog = payload.new as unknown as TrackingLog;
          setLogs((prev) => [newLog, ...prev]);
          toast.success('Perangkat baru terkoneksi!');
          try {
            const audio = new Audio(DING_SOUND_URL);
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {}
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const generateLink = async () => {
    if (!user) return;
    setGeneratingLink(true);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('connection_links').insert({
      link_token: token,
      created_by: user.id,
      expires_at: expiresAt,
    });

    if (!error) {
      const link = `${window.location.origin}/verify/${token}`;
      setLatestLink(link);
      toast.success('Link koneksi berhasil dibuat!');
    } else {
      toast.error('Gagal membuat link.');
    }
    setGeneratingLink(false);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(latestLink);
    setCopied(true);
    toast.success('Link disalin!');
    setTimeout(() => setCopied(false), 2000);
  };

  const photos = logs.filter((l) => l.photo_url);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={axonLogo} alt="Axon" className="h-8" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.username}
            </span>
            {user?.role === 'owner' && (
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin-area'}>
                Admin Panel
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Link Generator */}
        <div className="axon-card">
          <h2 className="axon-heading text-lg mb-3 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Generator Link Koneksi
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Buat URL koneksi unik yang kadaluarsa dalam 1 jam.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={generateLink} disabled={generatingLink}>
              {generatingLink ? 'Membuat...' : 'Buat Link Koneksi Baru'}
            </Button>
            {latestLink && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <code className="text-xs bg-secondary px-3 py-2 rounded-lg truncate flex-1">
                  {latestLink}
                </code>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'devices' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Smartphone className="w-4 h-4 inline mr-1" />
            Perangkat ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'photos' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Image className="w-4 h-4 inline mr-1" />
            Foto Verifikasi ({photos.length})
          </button>
        </div>

        {/* Device Cards */}
        {activeTab === 'devices' && (
          <div className="grid gap-4 md:grid-cols-2">
            {logs.length === 0 ? (
              <div className="col-span-full text-center py-16 axon-card">
                <Smartphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Belum ada perangkat terkoneksi.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Buat link koneksi dan bagikan ke perangkat lapangan.
                </p>
              </div>
            ) : (
              logs.map((log) => <DeviceCard key={log.id} log={log} />)
            )}
          </div>
        )}

        {/* Photo Gallery */}
        {activeTab === 'photos' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.length === 0 ? (
              <div className="col-span-full text-center py-16 axon-card">
                <Image className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Belum ada foto verifikasi.</p>
              </div>
            ) : (
              photos.map((log) => (
                <div key={log.id} className="axon-card p-0 overflow-hidden">
                  <img
                    src={log.photo_url!}
                    alt="Verifikasi"
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground">
                      {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
                    </p>
                    <a
                      href={log.photo_url!}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const DeviceCard = ({ log }: { log: TrackingLog }) => {
  const deviceInfo = log.device_info || {};
  const batteryColor = (log.battery_level ?? 0) > 20 ? 'text-accent' : 'text-destructive';

  return (
    <div className="axon-card-hover space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">
            {(deviceInfo as Record<string, string>).model || 'Perangkat Tidak Dikenal'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {(deviceInfo as Record<string, string>).os || '-'} · {(deviceInfo as Record<string, string>).browser || '-'}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoItem icon={<Battery className={`w-4 h-4 ${batteryColor}`} />} label="Baterai" value={`${log.battery_level ?? '-'}% ${log.is_charging ? '⚡' : ''}`} />
        <InfoItem icon={<Gauge className="w-4 h-4 text-primary" />} label="Kecepatan" value={`${log.speed?.toFixed(1) ?? '0'} km/h`} />
        <InfoItem icon={<MapPin className="w-4 h-4 text-primary" />} label="Akurasi GPS" value={`${log.accuracy?.toFixed(0) ?? '-'} m`} />
        <InfoItem icon={<Wifi className="w-4 h-4 text-primary" />} label="ISP" value={log.isp_provider || '-'} />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>IP: {log.ip_address || '-'}</span>
      </div>

      {log.latitude && log.longitude && (
        <a
          href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Buka di Google Maps
        </a>
      )}
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2">
    {icon}
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  </div>
);

export default UserDashboard;
