const CACHE = 'medlaikas-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Pranešimų siuntimas pagal suplanuotus laikus
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    scheduleCheck();
  }
});

// Tikrina kas minutę ar reikia siųsti pranešimą
function scheduleCheck() {
  setInterval(async () => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Pr, 7=Se

    // Gauti vaistus iš IndexedDB
    const medicines = await getMedicines();
    medicines.forEach(med => {
      if (!med.enabledDays || !med.enabledDays.includes(dayOfWeek)) return;
      (med.times || []).forEach(time => {
        if (time === hhmm) {
          // Siųsti 3 pranešimus
          self.registration.showNotification('💊 ' + med.name, {
            body: 'Laikas gerti vaistą' + (med.dose ? ': ' + med.dose : ''),
            icon: '/MedLaikas_iOS/icon.png',
            badge: '/MedLaikas_iOS/icon.png',
            tag: `med_${med.id}_${time}_0`,
            requireInteraction: true,
            data: { medId: med.id, time }
          });

          // +5 min priminimas
          setTimeout(() => {
            self.registration.showNotification('⏰ ' + med.name, {
              body: 'Priminimas: vaistas dar nepatvirtintas',
              tag: `med_${med.id}_${time}_1`,
              data: { medId: med.id, time }
            });
          }, 5 * 60 * 1000);

          // +15 min priminimas
          setTimeout(() => {
            self.registration.showNotification('❗ ' + med.name, {
              body: 'Svarbu: nepraleiskite dozės',
              tag: `med_${med.id}_${time}_2`,
              data: { medId: med.id, time }
            });
          }, 15 * 60 * 1000);
        }
      });
    });
  }, 60 * 1000); // kas minutę
}

// IndexedDB skaitymas iš Service Worker
function getMedicines() {
  return new Promise((res) => {
    const req = indexedDB.open('MedLaikasDB', 2);
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('medicines')) { res([]); return; }
      const tx = db.transaction('medicines', 'readonly');
      const store = tx.objectStore('medicines');
      const all = store.getAll();
      all.onsuccess = () => res(all.result || []);
      all.onerror = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

// Paspaudus pranešimą – atidaryti app'ą
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('MedLaikas') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/MedLaikas_iOS/');
    })
  );
});
