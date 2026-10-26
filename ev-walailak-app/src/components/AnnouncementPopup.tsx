import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { loadPublishedAnnouncements, markAnnouncementSeen, type PublishedAnnouncement } from '../auth/adminPortal';

interface Props { userId: string; sessionActive: boolean; onShowToast: (message: string) => void; }

export default function AnnouncementPopup({ userId, sessionActive, onShowToast }: Props) {
  const [unseen, setUnseen] = useState<PublishedAnnouncement[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadPublishedAnnouncements().then((result) => {
      if (mounted && result.data !== null) setUnseen(result.data.filter((item) => item.important && !item.seen));
    });
    return () => { mounted = false; };
  }, [userId]);

  const current = sessionActive ? null : unseen[0];
  if (!current) return null;

  async function acknowledge() {
    if (!current || busy) return;
    setBusy(true);
    const result = await markAnnouncementSeen(current.id);
    setBusy(false);
    if (result.error) { onShowToast(result.error); return; }
    setUnseen((items) => items.filter((item) => item.id !== current.id));
  }

  return <div className="announcement-popup-backdrop">
    <section className="announcement-popup" role="dialog" aria-modal="true" aria-labelledby="important-announcement-title">
      <span className="announcement-popup-icon"><Megaphone size={21} /></span>
      <p className="panel-kicker">ประกาศสำคัญจากโครงการ</p>
      <h2 id="important-announcement-title">{current.title}</h2>
      <p>{current.body}</p>
      <small>เผยแพร่ {new Date(current.published_at).toLocaleString('th-TH')}</small>
      <div className="button-row"><button className="button button-primary" type="button" disabled={busy} onClick={() => void acknowledge()}>{busy ? 'กำลังบันทึก…' : 'รับทราบ'}</button></div>
    </section>
  </div>;
}
