import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Trash2, UserRound } from 'lucide-react';
import { MAX_PROFILE_PHOTO_DATA_LENGTH } from '../auth/profilePhoto';

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;

interface ProfilePhotoControlProps {
  photo: string | null;
  name: string;
  onSave: (photo: string | null) => boolean;
}

export default function ProfilePhotoControl({ photo, name, onSave }: ProfilePhotoControlProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('เลือกรูป JPG, PNG หรือ WebP');
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setError('ไฟล์รูปต้นฉบับต้องมีขนาดไม่เกิน 25 MB');
      return;
    }

    try {
      const compressedPhoto = await compressProfilePhoto(file);
      if (!onSave(compressedPhoto)) {
        setError('บันทึกรูปไม่สำเร็จ · พื้นที่จัดเก็บในเบราว์เซอร์อาจไม่เพียงพอ');
        return;
      }
      setError('');
    } catch {
      setError('เปิดไฟล์รูปนี้ไม่ได้ กรุณาเลือกรูปอื่น');
    }
  }

  return (
    <div className="profile-photo-control">
      <div className="manager-profile-avatar">
        {photo ? <img src={photo} alt={`รูปโปรไฟล์ ${name}`} /> : <UserRound size={29} aria-hidden="true" />}
      </div>
      <input ref={fileInput} className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="เลือกรูปโปรไฟล์" onChange={handleFileChange} />
      <div className="profile-photo-actions">
        <button className="button button-outline" type="button" onClick={() => fileInput.current?.click()}><Camera size={14} aria-hidden="true" />เปลี่ยนรูป</button>
        {photo && <button className="profile-photo-remove" type="button" onClick={() => { if (onSave(null)) setError(''); else setError('ลบรูปไม่สำเร็จ · กรุณาลองอีกครั้ง'); }}><Trash2 size={14} aria-hidden="true" />ลบรูป</button>}
      </div>
      <small className="profile-photo-hint">JPG, PNG หรือ WebP · ไฟล์ต้นฉบับไม่เกิน 25 MB</small>
      {error && <small className="profile-photo-error" role="alert">{error}</small>}
    </div>
  );
}

function compressProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Unable to decode image'));
      image.onload = () => {
        const initialScale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
        let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas is unavailable'));
          return;
        }
        let quality = 0.82;
        let compressedPhoto = '';
        for (let attempt = 0; attempt < 12; attempt += 1) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          compressedPhoto = canvas.toDataURL('image/jpeg', quality);
          if (compressedPhoto.length <= MAX_PROFILE_PHOTO_DATA_LENGTH) {
            resolve(compressedPhoto);
            return;
          }
          if (quality > 0.5) quality = Math.max(0.5, quality - 0.12);
          else if (Math.max(width, height) > 192) {
            width = Math.max(1, Math.round(width * 0.82));
            height = Math.max(1, Math.round(height * 0.82));
            canvas.width = width;
            canvas.height = height;
            quality = 0.78;
          } else break;
        }
        reject(new Error('Unable to compress image to storage size'));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
