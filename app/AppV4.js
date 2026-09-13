import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { recognizeText } from 'expo-ocr-kit';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const API = 'https://rubber-pro-backend.onrender.com/api';
const SITE = 'https://lastik.toprakgrupglobal.com.tr';
const GOLD = '#D9A441';
const BG = '#080808';
const CARD = '#111111';
const STORAGE = {
  cart: 'toprak_one_cart',
  garage: 'toprak_one_garage',
  alerts: 'toprak_one_alerts',
  session: 'toprak_one_session',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function money(v) {
  return new Intl.NumberFormat('tr-TR').format(Number(v || 0)) + ' ₺';
}
function sizeOf(p) {
  return `${p.width || ''}/${p.profile || ''} R${p.rim || ''}`;
}
function seasonTr(v) {
  if (v === 'winter') return 'Kış';
  if (v === 'summer') return 'Yaz';
  if (v === 'all_season') return '4 Mevsim';
  return v || '';
}
function effectivePrice(p) {
  return Number(p.discount_price || p.price || 0);
}
function parseSize(text) {
  const cleaned = String(text || '').toUpperCase().replace(/\s+/g, ' ');
  const m = cleaned.match(/(\d{3})\s*[\/]\s*(\d{2,3})\s*(?:ZR|R)?\s*(\d{2})/);
  return m ? `${m[1]}/${m[2]} R${m[3]}` : '';
}
function normalize(s) {
  return String(s || '').toLocaleLowerCase('tr-TR');
}
async function jsonFetch(url, options = {}) {
  const r = await fetch(url, options);
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (!r.ok) throw new Error(data?.detail || data?.message || 'İşlem tamamlanamadı');
  return data;
}
async function ensureNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('price-alerts', {
      name: 'Fiyat Alarmları',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

function Shell() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('home');
  const [tool, setTool] = useState(null);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [cart, setCart] = useState([]);
  const [garage, setGarage] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [compare, setCompare] = useState([]);
  const [session, setSession] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, g, a, s] = await Promise.all([
          AsyncStorage.getItem(STORAGE.cart),
          AsyncStorage.getItem(STORAGE.garage),
          AsyncStorage.getItem(STORAGE.alerts),
          AsyncStorage.getItem(STORAGE.session),
        ]);
        if (c) setCart(JSON.parse(c));
        if (g) setGarage(JSON.parse(g));
        if (a) setAlerts(JSON.parse(a));
        if (s) setSession(JSON.parse(s));
      } catch {}
      setHydrated(true);
    })();
  }, []);

  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE.cart, JSON.stringify(cart)); }, [cart, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE.garage, JSON.stringify(garage)); }, [garage, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE.alerts, JSON.stringify(alerts)); }, [alerts, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (session) AsyncStorage.setItem(STORAGE.session, JSON.stringify(session));
    else AsyncStorage.removeItem(STORAGE.session);
  }, [session, hydrated]);

  const checkPriceAlerts = async (list) => {
    if (!alerts.length || !list.length) return;
    const next = alerts.map(a => ({ ...a }));
    let changed = false;
    for (const a of next) {
      const p = list.find(x => String(x.id) === String(a.productId));
      if (!p) continue;
      const now = effectivePrice(p);
      const target = Number(a.targetPrice || 0);
      if (target > 0 && now <= target && Number(a.notifiedPrice || 0) !== now) {
        try {
          if (await ensureNotificationPermission()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Toprak One • Fiyat düştü',
                body: `${p.brand} ${p.model} şimdi ${money(now)}`,
                data: { productId: String(p.id) },
              },
              trigger: null,
            });
          }
        } catch {}
        a.notifiedPrice = now;
        changed = true;
      }
    }
    if (changed) setAlerts(next);
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await jsonFetch(`${API}/products`);
      const list = Array.isArray(data) ? data : [];
      setProducts(list);
      setOffline(false);
      checkPriceAlerts(list);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    if (!session?.token) return;
    jsonFetch(`${API}/customer/me`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(customer => setSession(prev => ({ ...prev, customer })))
      .catch(() => setSession(null));
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const list = products.filter(p => Number(p.stock || 0) > 0);
    if (!q) return list;
    return list.filter(p => normalize(`${p.brand} ${p.model} ${sizeOf(p)} ${seasonTr(p.season)}`).includes(q));
  }, [products, query]);

  const cartCount = cart.reduce((s, x) => s + Number(x.qty || 0), 0);
  const cartTotal = cart.reduce((s, x) => s + effectivePrice(x) * Number(x.qty || 0), 0);

  const addToCart = (p) => {
    if (Number(p.stock || 0) <= 0) return Alert.alert('Stok yok', 'Bu ürün şu anda stokta değil.');
    setCart(prev => {
      const found = prev.find(x => x.id === p.id);
      if (found) return prev.map(x => x.id === p.id ? { ...x, qty: Math.min(Number(x.qty || 1) + 1, Number(p.stock || 1)) } : x);
      return [...prev, { ...p, qty: 1 }];
    });
    Alert.alert('Sepete eklendi', `${p.brand} ${p.model}`);
  };
  const updateQty = (id, delta) => {
    setCart(prev => prev.map(x => x.id === id ? { ...x, qty: Math.max(0, Math.min(Number(x.qty || 0) + delta, Number(x.stock || 1))) } : x).filter(x => x.qty > 0));
  };
  const saveAlert = async (product, targetPrice) => {
    const next = {
      productId: String(product.id),
      brand: product.brand,
      model: product.model,
      size: sizeOf(product),
      targetPrice: Number(targetPrice),
      createdPrice: effectivePrice(product),
      notifiedPrice: 0,
    };
    setAlerts(prev => [...prev.filter(a => a.productId !== next.productId), next]);
    try {
      if (await ensureNotificationPermission()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Fiyat alarmı aktif', body: `${product.brand} ${product.model} için ${money(targetPrice)} hedefi kaydedildi.` },
          trigger: null,
        });
      }
    } catch {}
  };
  const detectedSize = (size) => {
    setQuery(size);
    setTool(null);
    setTab('shop');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topbar}>
          <View><Text style={styles.logo}>TOPRAK<Text style={styles.gold}>ONE</Text></Text><Text style={styles.logoSub}>GLOBAL MOBILITY</Text></View>
          <Pressable style={styles.cartBadge} onPress={() => setTab('cart')}><Text style={styles.cartBadgeText}>🛒 {cartCount}</Text></Pressable>
        </View>
      </SafeAreaView>

      {offline && <Pressable style={styles.offlineBar} onPress={loadProducts}><Text style={styles.offlineText}>Canlı stok bağlantısı yok • tekrar dene</Text></Pressable>}

      <View style={styles.body}>
        {tab === 'home' && <Home products={products} loading={loading} setTab={setTab} openTool={setTool} addToCart={addToCart} />}
        {tab === 'shop' && <Shop query={query} setQuery={setQuery} products={filtered} loading={loading} addToCart={addToCart} compare={compare} setCompare={setCompare} alerts={alerts} saveAlert={saveAlert} />}
        {tab === 'cart' && <Cart cart={cart} total={cartTotal} updateQty={updateQty} setCart={setCart} session={session} />}
        {tab === 'garage' && <Garage garage={garage} setGarage={setGarage} />}
        {tab === 'profile' && <Profile session={session} setSession={setSession} garage={garage} alerts={alerts} />}
      </View>

      <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Tab label="Ana" icon="⌂" active={tab === 'home'} onPress={() => setTab('home')} />
        <Tab label="Mağaza" icon="◈" active={tab === 'shop'} onPress={() => setTab('shop')} />
        <Tab label={`Sepet${cartCount ? ` ${cartCount}` : ''}`} icon="▤" active={tab === 'cart'} onPress={() => setTab('cart')} />
        <Tab label="Garaj" icon="▣" active={tab === 'garage'} onPress={() => setTab('garage')} />
        <Tab label="Hesabım" icon="○" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>

      <ToolModal tool={tool} onClose={() => setTool(null)} products={products} onDetectedSize={detectedSize} addToCart={addToCart} compare={compare} setCompare={setCompare} alerts={alerts} saveAlert={saveAlert} />
    </View>
  );
}

function Home({ products, loading, setTab, openTool, addToCart }) {
  const stock = products.reduce((s, p) => s + Number(p.stock || 0), 0);
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><View style={styles.heroGlow} /><View style={styles.badge}><Text style={styles.badgeText}>TOPRAK ONE • 0.4</Text></View><Text style={styles.eyebrow}>AKILLI MOBİL LASTİK PLATFORMU</Text><Text style={styles.heroTitle}>Oku. Karşılaştır.{`\n`}Takip et. <Text style={styles.gold}>Güvenle al.</Text></Text><Text style={styles.heroText}>Kameradan ebat okuma, kalıcı garaj, müşteri hesabı, sipariş geçmişi ve canlı fiyat takibi tek uygulamada.</Text><View style={styles.stats}><Stat value={loading ? '...' : String(stock)} label="CANLI STOK" /><Stat value={loading ? '...' : String(new Set(products.map(p => p.brand)).size)} label="MARKA" /><Stat value="OCR" label="EBAT OKUMA" /></View></View>
    <SectionTitle title="Hızlı Başla" right="4 akıllı araç" />
    <View style={styles.grid}><Quick icon="◎" title="Kamerayla Tara" sub="Ebatı OCR ile oku" onPress={() => openTool('camera')} /><Quick icon="AI" title="Akıllı Danışman" sub="İhtiyacını yaz" onPress={() => openTool('finder')} /><Quick icon="↕" title="Karşılaştır" sub="3 ürünü kıyasla" onPress={() => openTool('compare')} /><Quick icon="⚡" title="Fiyat Alarmı" sub="Hedef fiyat belirle" onPress={() => openTool('alert')} /></View>
    <Pressable style={styles.scanBanner} onPress={() => setTab('shop')}><View style={styles.scanIcon}><Text style={styles.scanIconText}>◈</Text></View><View style={{ flex: 1 }}><Text style={styles.scanTitle}>Canlı mağazayı aç</Text><Text style={styles.muted}>Güncel fiyat ve stokları görüntüle.</Text></View><Text style={styles.chev}>›</Text></Pressable>
    <SectionTitle title="Canlı Öneriler" right="Tümünü gör" onRight={() => setTab('shop')} />
    {loading ? <ActivityIndicator color={GOLD} /> : products.filter(p => Number(p.stock || 0) > 0).slice(0, 3).map(p => <ProductCard key={p.id} p={p} onAdd={() => addToCart(p)} />)}
  </ScrollView>;
}

function Shop({ query, setQuery, products, loading, addToCart, compare, setCompare, alerts, saveAlert }) {
  const [alertProduct, setAlertProduct] = useState(null);
  return <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>CANLI MAĞAZA</Text><Text style={styles.pageTitle}>Doğru lastiği bul.</Text>
    <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="205/55 R16, Michelin..." placeholderTextColor="#666" /></View>
    {loading && <ActivityIndicator color={GOLD} style={{ marginTop: 30 }} />}
    {!loading && products.length === 0 && <Text style={styles.pageText}>Aramana uygun stoklu ürün bulunamadı.</Text>}
    {products.map(p => <ProductCard key={p.id} p={p} onAdd={() => addToCart(p)} selected={compare.includes(p.id)} onCompare={() => setCompare(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)} alerting={alerts.some(a => a.productId === String(p.id))} onAlert={() => setAlertProduct(p)} />)}
    <PriceAlertModal product={alertProduct} onClose={() => setAlertProduct(null)} onSave={saveAlert} />
  </ScrollView>;
}

function Cart({ cart, total, updateQty, setCart, session }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.eyebrow}>SEPETİM</Text><Text style={styles.pageTitle}>{cart.length ? 'Siparişe hazırsın.' : 'Sepetin boş.'}</Text>
    {cart.map(p => <View key={p.id} style={styles.cartRow}><View style={{ flex: 1 }}><Text style={styles.menuText}>{p.brand} {p.model}</Text><Text style={styles.muted}>{sizeOf(p)} • {money(effectivePrice(p))}</Text></View><Pressable style={styles.qtyBtn} onPress={() => updateQty(p.id, -1)}><Text style={styles.qtyText}>−</Text></Pressable><Text style={styles.qtyValue}>{p.qty}</Text><Pressable style={styles.qtyBtn} onPress={() => updateQty(p.id, 1)}><Text style={styles.qtyText}>+</Text></Pressable></View>)}
    {!!cart.length && <><View style={styles.totalRow}><Text style={styles.menuText}>Toplam</Text><Text style={styles.totalText}>{money(total)}</Text></View><GoldButton label="Güvenli Ödemeye Geç" onPress={() => setCheckoutOpen(true)} /><Pressable onPress={() => setCart([])}><Text style={styles.clearText}>Sepeti temizle</Text></Pressable></>}
    <CheckoutModal visible={checkoutOpen} onClose={() => setCheckoutOpen(false)} cart={cart} session={session} />
  </ScrollView>;
}

function CheckoutModal({ visible, onClose, cart, session }) {
  const customer = session?.customer || {};
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [address, setAddress] = useState(''); const [city, setCity] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!visible) return; setName(customer.name || ''); setPhone(customer.phone || ''); setEmail(customer.email || ''); setAddress(customer.addresses?.[0]?.text || ''); }, [visible]);
  const checkout = async () => {
    if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) return Alert.alert('Eksik bilgi', 'Ad soyad, telefon, şehir ve adres zorunlu.');
    setBusy(true);
    try {
      const data = await jsonFetch(`${API}/payments/iyzico/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map(x => ({ product_id: String(x.id), qty: x.qty })), origin_url: SITE, name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim(), city: city.trim(), zip_code: '00000', note: 'Toprak One 0.4 mobil uygulama siparişi' }) });
      const url = data.checkout_url || data.payment_page_url; if (!url) throw new Error('Ödeme bağlantısı alınamadı'); await Linking.openURL(url); onClose();
    } catch (e) { Alert.alert('Ödeme hatası', String(e.message || e)); } finally { setBusy(false); }
  };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.modalSafe} edges={['top','bottom']}><View style={styles.modalHead}><Text style={styles.modalTitle}>Teslimat ve Ödeme</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.modalContent}><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ad soyad" placeholderTextColor="#666" /><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Telefon" placeholderTextColor="#666" keyboardType="phone-pad" /><TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="E-posta" placeholderTextColor="#666" autoCapitalize="none" keyboardType="email-address" /><TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Şehir" placeholderTextColor="#666" /><TextInput style={[styles.input, { minHeight: 90 }]} value={address} onChangeText={setAddress} placeholder="Teslimat adresi" placeholderTextColor="#666" multiline /><GoldButton label={busy ? 'Hazırlanıyor...' : 'İyzico Ödemesini Aç'} onPress={busy ? null : checkout} /></ScrollView></SafeAreaView></Modal>;
}

function Garage({ garage, setGarage }) {
  const [brand, setBrand] = useState(''); const [model, setModel] = useState(''); const [year, setYear] = useState(''); const [size, setSize] = useState('');
  const add = () => { if (!brand.trim() || !model.trim()) return Alert.alert('Eksik bilgi', 'Marka ve model gir.'); setGarage(prev => [...prev, { id: String(Date.now()), brand: brand.trim(), model: model.trim(), year: year.trim(), size: size.trim() }]); setBrand(''); setModel(''); setYear(''); setSize(''); };
  return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.eyebrow}>BENİM GARAJIM</Text><Text style={styles.pageTitle}>Araçların kalıcı kayıtlı.</Text><TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Marka" placeholderTextColor="#666" /><TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Model" placeholderTextColor="#666" /><TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="Yıl" placeholderTextColor="#666" keyboardType="numeric" /><TextInput style={styles.input} value={size} onChangeText={setSize} placeholder="Lastik ebatı (örn. 205/55 R16)" placeholderTextColor="#666" /><GoldButton label="Aracı Kaydet" onPress={add} />{garage.map(v => <View key={v.id} style={styles.menuRow}><View><Text style={styles.menuText}>{v.brand} {v.model}</Text><Text style={styles.muted}>{[v.year, v.size].filter(Boolean).join(' • ')}</Text></View><Pressable onPress={() => setGarage(prev => prev.filter(x => x.id !== v.id))}><Text style={styles.danger}>Sil</Text></Pressable></View>)}</ScrollView>;
}

function Profile({ session, setSession, garage, alerts }) {
  const [mode, setMode] = useState('login'); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [orders, setOrders] = useState([]); const [ordersBusy, setOrdersBusy] = useState(false);
  const auth = async () => { setBusy(true); try { const payload = mode === 'register' ? { name, phone, email, password } : { email, password }; const data = await jsonFetch(`${API}/customer/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setSession({ token: data.token, customer: data.customer }); setPassword(''); } catch (e) { Alert.alert('Hesap', e.message); } finally { setBusy(false); } };
  const loadOrders = async () => { if (!session?.token) return; setOrdersBusy(true); try { const data = await jsonFetch(`${API}/customer/orders`, { headers: { Authorization: `Bearer ${session.token}` } }); setOrders(Array.isArray(data) ? data : []); } catch (e) { Alert.alert('Siparişler', e.message); } finally { setOrdersBusy(false); } };
  useEffect(() => { if (session?.token) loadOrders(); }, [session?.token]);
  if (!session) return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.eyebrow}>HESABIM</Text><Text style={styles.pageTitle}>{mode === 'login' ? 'Giriş yap.' : 'Hesap oluştur.'}</Text>{mode === 'register' && <><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ad soyad" placeholderTextColor="#666" /><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Telefon" placeholderTextColor="#666" /></>}<TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="E-posta" placeholderTextColor="#666" autoCapitalize="none" keyboardType="email-address" /><TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Şifre" placeholderTextColor="#666" secureTextEntry /><GoldButton label={busy ? 'Bekleyin...' : mode === 'login' ? 'Giriş Yap' : 'Üye Ol'} onPress={busy ? null : auth} /><Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}><Text style={styles.switchText}>{mode === 'login' ? 'Hesabın yok mu? Üye ol' : 'Zaten hesabın var mı? Giriş yap'}</Text></Pressable></ScrollView>;
  const c = session.customer || {};
  return <ScrollView contentContainerStyle={styles.scroll}><Text style={styles.eyebrow}>HESABIM</Text><Text style={styles.pageTitle}>{c.name || 'Toprak One Üyesi'}</Text><Text style={styles.pageText}>{c.email || ''}</Text><View style={styles.summaryRow}><Summary value={garage.length} label="Araç" /><Summary value={alerts.length} label="Fiyat alarmı" /><Summary value={orders.length} label="Sipariş" /></View><SectionTitle title="Sipariş Geçmişi" right="Yenile" onRight={loadOrders} />{ordersBusy && <ActivityIndicator color={GOLD} />}{!ordersBusy && !orders.length && <Text style={styles.muted}>Henüz sipariş bulunamadı.</Text>}{orders.slice(0, 20).map(o => <View key={o.id} style={styles.orderCard}><View style={{ flex: 1 }}><Text style={styles.menuText}>#{String(o.id).slice(0, 8)}</Text><Text style={styles.muted}>{o.created_at ? new Date(o.created_at).toLocaleDateString('tr-TR') : ''} • {o.status || o.payment_status || 'İşleniyor'}</Text></View><Text style={styles.gold}>{money(o.total)}</Text></View>)}<GoldButton label="Sipariş / Kargo Takibini Aç" onPress={() => Linking.openURL(`${SITE}/hesabim/kargo`)} /><Pressable onPress={() => setSession(null)}><Text style={styles.dangerCenter}>Çıkış yap</Text></Pressable></ScrollView>;
}

function ToolModal({ tool, onClose, products, onDetectedSize, addToCart, compare, setCompare, alerts, saveAlert }) {
  return <Modal visible={!!tool} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.modalSafe} edges={['top','bottom']}><View style={styles.modalHead}><Text style={styles.modalTitle}>{tool === 'camera' ? 'Kamerayla Ebat Oku' : tool === 'finder' ? 'Akıllı Danışman' : tool === 'compare' ? 'Karşılaştır' : 'Fiyat Alarmı'}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>{tool === 'camera' && <CameraTool onDetected={onDetectedSize} />}{tool === 'finder' && <FinderTool products={products} addToCart={addToCart} />}{tool === 'compare' && <CompareTool products={products} compare={compare} setCompare={setCompare} />}{tool === 'alert' && <AlertTool products={products} alerts={alerts} saveAlert={saveAlert} />}</SafeAreaView></Modal>;
}

function CameraTool({ onDetected }) {
  const [permission, requestPermission] = useCameraPermissions(); const ref = useRef(null); const [busy, setBusy] = useState(false); const [rawText, setRawText] = useState(''); const [detected, setDetected] = useState('');
  if (!permission) return <CenterText text="Kamera hazırlanıyor..." />;
  if (!permission.granted) return <View style={styles.center}><Text style={styles.pageText}>Lastik yanağındaki ebatı okumak için kamera izni gerekli.</Text><GoldButton label="Kamera İzni Ver" onPress={requestPermission} /></View>;
  const scan = async () => { setBusy(true); setRawText(''); setDetected(''); try { const photo = await ref.current?.takePictureAsync({ quality: 0.9, skipProcessing: false }); if (!photo?.uri) throw new Error('Fotoğraf alınamadı'); const result = await recognizeText(photo.uri); const text = result?.text || ''; const size = parseSize(text); setRawText(text); setDetected(size); if (!size) Alert.alert('Ebat bulunamadı', 'Lastik yanağındaki 205/55 R16 gibi yazıya daha yakından odaklanıp tekrar dene.'); } catch (e) { Alert.alert('OCR', `Ebat okunamadı: ${e.message || e}`); } finally { setBusy(false); } };
  return <View style={{ flex: 1 }}><CameraView ref={ref} style={styles.camera} facing="back" /><View style={styles.cameraOverlay}><Text style={styles.cameraHint}>205/55 R16 benzeri ebat yazısını çerçeveye al.</Text></View><Pressable style={styles.shutter} onPress={busy ? null : scan}><View style={styles.shutterInner} /></Pressable>{busy && <View style={styles.notice}><ActivityIndicator color={GOLD} /><Text style={styles.noticeText}>Yazı okunuyor...</Text></View>}{detected ? <View style={styles.ocrResult}><Text style={styles.ocrBig}>{detected}</Text><GoldButton label="Bu Ebatı Mağazada Ara" onPress={() => onDetected(detected)} /></View> : !!rawText && <View style={styles.notice}><Text style={styles.noticeText}>Metin bulundu ancak standart ebat seçilemedi.</Text></View>}</View>;
}

function FinderTool({ products, addToCart }) {
  const [text, setText] = useState(''); const [results, setResults] = useState([]);
  const run = () => {
    const q = normalize(text); const size = parseSize(text); const season = q.includes('kış') ? 'winter' : q.includes('yaz') ? 'summer' : (q.includes('4 mevsim') || q.includes('dört mevsim')) ? 'all_season' : '';
    const knownBrands = [...new Set(products.map(p => p.brand).filter(Boolean))]; const brand = knownBrands.find(b => q.includes(normalize(b)));
    const nums = [...text.matchAll(/\b(\d{4,6})\b/g)].map(m => Number(m[1])); const budget = nums.length ? Math.max(...nums) : 0;
    const ranked = products.filter(p => Number(p.stock || 0) > 0).map(p => { let score = 0; if (size && normalize(sizeOf(p)) === normalize(size)) score += 100; if (season && p.season === season) score += 40; if (brand && p.brand === brand) score += 30; if (budget && effectivePrice(p) <= budget) score += 20; score += Math.min(Number(p.stock || 0), 20) / 20; return { p, score }; }).sort((a,b) => b.score - a.score || effectivePrice(a.p) - effectivePrice(b.p)).slice(0, 3).map(x => x.p);
    setResults(ranked);
  };
  return <ScrollView contentContainerStyle={styles.modalContent}><Text style={styles.pageText}>Örnek: “205/55 R16 kış, Michelin olsun, 6000 TL altında.”</Text><TextInput style={[styles.input, { minHeight: 110 }]} value={text} onChangeText={setText} placeholder="İhtiyacını doğal şekilde yaz..." placeholderTextColor="#666" multiline /><GoldButton label="Canlı Stoktan Öner" onPress={run} />{results.map((p, i) => <View key={p.id}><Text style={styles.rank}>#{i + 1} öneri</Text><ProductCard p={p} onAdd={() => addToCart(p)} /></View>)}</ScrollView>;
}

function CompareTool({ products, compare, setCompare }) {
  const list = products.filter(p => Number(p.stock || 0) > 0).slice(0, 40); const chosen = products.filter(p => compare.includes(p.id));
  return <ScrollView contentContainerStyle={styles.modalContent}><Text style={styles.pageText}>En fazla 3 ürünü seç.</Text>{list.map(p => <Pressable key={p.id} style={[styles.selectRow, compare.includes(p.id) && styles.selectRowActive]} onPress={() => setCompare(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)}><View style={{ flex: 1 }}><Text style={styles.menuText}>{p.brand} {p.model}</Text><Text style={styles.muted}>{sizeOf(p)}</Text></View><Text style={styles.gold}>{compare.includes(p.id) ? 'Seçildi' : '+'}</Text></Pressable>)}{!!chosen.length && <View style={styles.compareBox}>{chosen.map(p => <View key={p.id} style={styles.compareCol}><Text style={styles.compareBrand}>{p.brand}</Text><Text style={styles.muted}>{p.model}</Text><Text style={styles.compareScore}>{money(effectivePrice(p))}</Text><Text style={styles.muted}>Stok: {p.stock}</Text><Text style={styles.muted}>{seasonTr(p.season)}</Text></View>)}</View>}</ScrollView>;
}

function AlertTool({ products, alerts, saveAlert }) {
  const list = products.filter(p => Number(p.stock || 0) > 0).slice(0, 30); const [selected, setSelected] = useState(null);
  return <ScrollView contentContainerStyle={styles.modalContent}><Text style={styles.pageText}>Bir ürün seç ve hedef fiyatını belirle.</Text>{alerts.map(a => <View key={a.productId} style={styles.alertRow}><View><Text style={styles.menuText}>{a.brand} {a.model}</Text><Text style={styles.muted}>Hedef: {money(a.targetPrice)}</Text></View><Text style={styles.gold}>Aktif</Text></View>)}{list.map(p => <Pressable key={p.id} style={styles.selectRow} onPress={() => setSelected(p)}><View style={{ flex: 1 }}><Text style={styles.menuText}>{p.brand} {p.model}</Text><Text style={styles.muted}>{sizeOf(p)} • {money(effectivePrice(p))}</Text></View><Text style={styles.gold}>Alarm</Text></Pressable>)}<PriceAlertModal product={selected} onClose={() => setSelected(null)} onSave={saveAlert} /></ScrollView>;
}

function PriceAlertModal({ product, onClose, onSave }) {
  const [target, setTarget] = useState('');
  useEffect(() => { if (product) setTarget(String(Math.max(1, Math.round(effectivePrice(product) * 0.95)))); }, [product]);
  if (!product) return null;
  return <Modal visible animationType="fade" transparent onRequestClose={onClose}><View style={styles.overlay}><View style={styles.dialog}><Text style={styles.modalTitle}>Fiyat Alarmı</Text><Text style={styles.pageText}>{product.brand} {product.model}{'\n'}Şu an: {money(effectivePrice(product))}</Text><TextInput style={styles.input} value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="Hedef fiyat" placeholderTextColor="#666" /><GoldButton label="Alarmı Kaydet" onPress={() => { const n = Number(target); if (!n) return; onSave(product, n); onClose(); }} /><Pressable onPress={onClose}><Text style={styles.clearText}>Vazgeç</Text></Pressable></View></View></Modal>;
}

function ProductCard({ p, onAdd, selected, onCompare, alerting, onAlert }) {
  return <View style={styles.productCard}><View style={{ flex: 1 }}><View style={styles.productTop}><Text style={styles.productBrand}>{p.brand}</Text><Text style={styles.stock}>Stok {p.stock}</Text></View><Text style={styles.productName}>{p.model}</Text><Text style={styles.productMeta}>{sizeOf(p)} • {seasonTr(p.season)}</Text><Text style={styles.price}>{money(effectivePrice(p))}</Text><View style={styles.actionRow}>{onAdd && <MiniButton label="Sepete Ekle" onPress={onAdd} />}{onCompare && <MiniButton label={selected ? 'Seçildi' : 'Karşılaştır'} onPress={onCompare} subtle />}{onAlert && <MiniButton label={alerting ? 'Alarm Aktif' : 'Alarm'} onPress={onAlert} subtle />}</View></View></View>;
}
function Tab({ label, icon, active, onPress }) { return <Pressable style={styles.tab} onPress={onPress}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text></Pressable>; }
function Quick({ icon, title, sub, onPress }) { return <Pressable style={styles.quickCard} onPress={onPress}><View style={styles.quickIcon}><Text style={styles.quickIconText}>{icon}</Text></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickSub}>{sub}</Text></Pressable>; }
function Stat({ value, label }) { return <View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function SectionTitle({ title, right, onRight }) { return <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onRight}><Text style={styles.sectionRight}>{right}</Text></Pressable></View>; }
function GoldButton({ label, onPress }) { return <Pressable style={[styles.goldButton, !onPress && { opacity: .55 }]} onPress={onPress}><Text style={styles.goldButtonText}>{label}</Text></Pressable>; }
function MiniButton({ label, onPress, subtle }) { return <Pressable style={[styles.miniBtn, subtle && styles.miniBtnSubtle]} onPress={onPress}><Text style={[styles.miniBtnText, subtle && styles.miniBtnTextSubtle]}>{label}</Text></Pressable>; }
function Summary({ value, label }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>; }
function CenterText({ text }) { return <View style={styles.center}><Text style={styles.muted}>{text}</Text></View>; }

export default function App() { return <SafeAreaProvider><Shell /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG }, safeTop: { backgroundColor: BG }, body: { flex: 1 }, scroll: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 130 },
  topbar: { minHeight: 76, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#181818' }, logo: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 }, logoSub: { color: '#686868', fontSize: 9, letterSpacing: 3, marginTop: 5 }, gold: { color: GOLD },
  cartBadge: { minWidth: 64, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#594113', backgroundColor: '#17130b', alignItems: 'center', justifyContent: 'center' }, cartBadgeText: { color: GOLD, fontWeight: '900' },
  offlineBar: { backgroundColor: '#3b1d16', paddingVertical: 8, alignItems: 'center' }, offlineText: { color: '#ff9a7d', fontSize: 11, fontWeight: '700' },
  hero: { minHeight: 390, borderRadius: 28, backgroundColor: CARD, borderWidth: 1, borderColor: '#262626', padding: 24, overflow: 'hidden', justifyContent: 'flex-end' }, heroGlow: { position: 'absolute', width: 250, height: 250, borderRadius: 125, right: -70, top: -70, backgroundColor: '#3c2a08', opacity: .8 }, badge: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#604613', backgroundColor: '#20190b', borderRadius: 22, paddingVertical: 7, paddingHorizontal: 13, marginBottom: 25 }, badgeText: { color: GOLD, fontWeight: '800', letterSpacing: 2, fontSize: 10 }, eyebrow: { color: '#9a9a9e', fontSize: 11, letterSpacing: 3, fontWeight: '800', marginBottom: 14 }, heroTitle: { color: '#fff', fontWeight: '900', fontSize: 34, lineHeight: 42 }, heroText: { color: '#a8a8aa', fontSize: 15, lineHeight: 24, marginTop: 22 }, stats: { borderTopWidth: 1, borderTopColor: '#292929', marginTop: 30, paddingTop: 22, flexDirection: 'row', justifyContent: 'space-between' }, statValue: { color: '#fff', fontWeight: '900', fontSize: 23 }, statLabel: { color: '#69696d', fontSize: 9, letterSpacing: 2.2, marginTop: 7 },
  sectionHead: { marginTop: 30, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '900' }, sectionRight: { color: '#757579', fontSize: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, quickCard: { width: '48.5%', minHeight: 150, borderRadius: 24, borderWidth: 1, borderColor: '#282828', backgroundColor: '#111', padding: 18, marginBottom: 14, justifyContent: 'flex-end' }, quickIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#211b0c', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, quickIconText: { color: GOLD, fontWeight: '900', fontSize: 18 }, quickTitle: { color: '#fff', fontWeight: '800', fontSize: 16 }, quickSub: { color: '#67676b', fontSize: 12, marginTop: 6 },
  scanBanner: { marginTop: 6, borderRadius: 24, borderWidth: 1, borderColor: '#4d3a16', backgroundColor: '#15120b', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, scanIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, scanIconText: { fontSize: 22, fontWeight: '900' }, scanTitle: { color: '#fff', fontWeight: '900', fontSize: 16 }, muted: { color: '#77777b', fontSize: 12, marginTop: 3 }, chev: { color: '#777', fontSize: 28 },
  pageTitle: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 14 }, pageText: { color: '#9b9ba0', fontSize: 14, lineHeight: 22, marginBottom: 18 }, searchBox: { height: 54, borderRadius: 18, borderWidth: 1, borderColor: '#2b2b2b', backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 18 }, searchIcon: { color: GOLD, fontSize: 22, marginRight: 10 }, searchInput: { flex: 1, color: '#fff', fontSize: 15 }, input: { minHeight: 54, borderRadius: 17, borderWidth: 1, borderColor: '#2b2b2b', backgroundColor: '#111', color: '#fff', paddingHorizontal: 15, paddingVertical: 12, marginBottom: 12 },
  productCard: { borderRadius: 22, borderWidth: 1, borderColor: '#282828', backgroundColor: '#111', padding: 18, marginBottom: 14 }, productTop: { flexDirection: 'row', justifyContent: 'space-between' }, productBrand: { color: GOLD, fontWeight: '900', fontSize: 13 }, stock: { color: '#75c98a', fontSize: 11, fontWeight: '700' }, productName: { color: '#fff', fontWeight: '900', fontSize: 19, marginTop: 8 }, productMeta: { color: '#7d7d82', fontSize: 12, marginTop: 5 }, price: { color: '#fff', fontSize: 23, fontWeight: '900', marginTop: 13 }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }, miniBtn: { backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, miniBtnSubtle: { backgroundColor: '#181818', borderWidth: 1, borderColor: '#303030' }, miniBtnText: { color: '#090909', fontWeight: '900', fontSize: 11 }, miniBtnTextSubtle: { color: '#ddd' },
  tabbar: { flexDirection: 'row', minHeight: 72, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#0d0d0d' }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 }, tabIcon: { color: '#5d5d61', fontSize: 21 }, tabLabel: { color: '#5d5d61', fontSize: 10, marginTop: 5 }, tabActive: { color: GOLD },
  cartRow: { minHeight: 82, borderBottomWidth: 1, borderBottomColor: '#242424', flexDirection: 'row', alignItems: 'center', gap: 8 }, menuText: { color: '#fff', fontWeight: '800', fontSize: 14 }, qtyBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1b1b1b', alignItems: 'center', justifyContent: 'center' }, qtyText: { color: GOLD, fontSize: 20 }, qtyValue: { color: '#fff', fontWeight: '900', minWidth: 22, textAlign: 'center' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, marginBottom: 18 }, totalText: { color: GOLD, fontWeight: '900', fontSize: 24 }, clearText: { color: '#777', textAlign: 'center', padding: 18 },
  goldButton: { minHeight: 54, borderRadius: 17, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginVertical: 7 }, goldButtonText: { color: '#090909', fontWeight: '900', fontSize: 14 }, switchText: { color: GOLD, textAlign: 'center', marginTop: 18, fontWeight: '700' }, danger: { color: '#ff7567', fontWeight: '800' }, dangerCenter: { color: '#ff7567', fontWeight: '800', textAlign: 'center', paddingVertical: 24 },
  menuRow: { minHeight: 72, borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, summaryRow: { flexDirection: 'row', gap: 10, marginVertical: 16 }, summary: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: '#262626', backgroundColor: '#111', padding: 15 }, summaryValue: { color: '#fff', fontWeight: '900', fontSize: 22 }, orderCard: { borderRadius: 18, borderWidth: 1, borderColor: '#272727', backgroundColor: '#111', padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modalSafe: { flex: 1, backgroundColor: BG }, modalHead: { minHeight: 70, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#202020', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: '#fff', fontWeight: '900', fontSize: 20 }, close: { color: '#fff', fontSize: 34 }, modalContent: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }, camera: { flex: 1 }, cameraOverlay: { position: 'absolute', left: 25, right: 25, top: 90, borderWidth: 2, borderColor: GOLD, borderRadius: 20, height: 150, alignItems: 'center', justifyContent: 'flex-end', padding: 12 }, cameraHint: { color: '#fff', backgroundColor: '#000a', padding: 8, borderRadius: 10, fontSize: 12 }, shutter: { position: 'absolute', bottom: 45, alignSelf: 'center', width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: GOLD }, notice: { position: 'absolute', left: 18, right: 18, bottom: 140, borderRadius: 16, backgroundColor: '#111e', padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }, noticeText: { color: '#fff', flex: 1, fontSize: 12 }, ocrResult: { position: 'absolute', left: 18, right: 18, bottom: 130, backgroundColor: '#101010ee', borderWidth: 1, borderColor: '#4e3b16', borderRadius: 20, padding: 18 }, ocrBig: { color: GOLD, fontWeight: '900', fontSize: 30, textAlign: 'center', marginBottom: 10 }, rank: { color: GOLD, fontSize: 11, fontWeight: '900', marginTop: 18, marginBottom: 6 },
  selectRow: { minHeight: 68, borderBottomWidth: 1, borderBottomColor: '#242424', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectRowActive: { backgroundColor: '#17130b' }, compareBox: { flexDirection: 'row', gap: 8, marginTop: 20 }, compareCol: { flex: 1, borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 16, padding: 10, backgroundColor: '#111' }, compareBrand: { color: GOLD, fontWeight: '900', fontSize: 12 }, compareScore: { color: '#fff', fontWeight: '900', marginVertical: 7 }, alertRow: { minHeight: 66, borderRadius: 15, borderWidth: 1, borderColor: '#403314', backgroundColor: '#15120b', paddingHorizontal: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlay: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: 20 }, dialog: { width: '100%', maxWidth: 420, borderRadius: 24, backgroundColor: '#101010', borderWidth: 1, borderColor: '#303030', padding: 20 },
});
