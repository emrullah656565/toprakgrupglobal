import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API = 'https://rubber-pro-backend.onrender.com/api';
const SITE = 'https://lastik.toprakgrupglobal.com.tr';
const GOLD = '#D9A441';
const BG = '#080808';
const CARD = '#111111';

const fallbackProducts = [
  { id: 'demo-1', brand: 'Michelin', model: 'Alpin 7', width: 205, profile: 55, rim: 16, price: 4890, stock: 10, season: 'winter' },
  { id: 'demo-2', brand: 'Bridgestone', model: 'Blizzak 6', width: 205, profile: 55, rim: 16, price: 4650, stock: 10, season: 'winter' },
];

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

  const loadProducts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/products`);
      if (!r.ok) throw new Error('Ürün servisi yanıt vermedi');
      const data = await r.json();
      setProducts(Array.isArray(data) ? data : []);
      setOffline(false);
    } catch {
      setProducts(fallbackProducts);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter(p => Number(p.stock || 0) > 0);
    if (!q) return list;
    return list.filter(p => `${p.brand} ${p.model} ${sizeOf(p)} ${seasonTr(p.season)}`.toLowerCase().includes(q));
  }, [products, query]);

  const cartCount = cart.reduce((s, x) => s + x.qty, 0);
  const cartTotal = cart.reduce((s, x) => s + effectivePrice(x) * x.qty, 0);

  const addToCart = (p) => {
    if (String(p.id).startsWith('demo-')) return Alert.alert('Canlı bağlantı gerekli', 'Demo ürün ödeme sepetine eklenemez.');
    if (Number(p.stock || 0) <= 0) return Alert.alert('Stok yok', 'Bu ürün şu anda stokta değil.');
    setCart(prev => {
      const found = prev.find(x => x.id === p.id);
      if (found) return prev.map(x => x.id === p.id ? { ...x, qty: Math.min(x.qty + 1, Number(p.stock || 1)) } : x);
      return [...prev, { ...p, qty: 1 }];
    });
    Alert.alert('Sepete eklendi', `${p.brand} ${p.model}`);
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev
      .map(x => x.id === id ? { ...x, qty: Math.max(0, Math.min(x.qty + delta, Number(x.stock || 1))) } : x)
      .filter(x => x.qty > 0));
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.logo}>TOPRAK<Text style={styles.gold}>ONE</Text></Text>
            <Text style={styles.logoSub}>GLOBAL MOBILITY</Text>
          </View>
          <Pressable style={styles.cartBadge} onPress={() => setTab('cart')}>
            <Text style={styles.cartBadgeText}>🛒 {cartCount}</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {offline && <Pressable style={styles.offlineBar} onPress={loadProducts}><Text style={styles.offlineText}>Canlı stok bağlantısı yok • tekrar dene</Text></Pressable>}

      <View style={styles.body}>
        {tab === 'home' && <Home products={products} loading={loading} openTool={setTool} setTab={setTab} addToCart={addToCart} />}
        {tab === 'shop' && <Shop query={query} setQuery={setQuery} products={filtered} loading={loading} addToCart={addToCart} compare={compare} setCompare={setCompare} alerts={alerts} setAlerts={setAlerts} />}
        {tab === 'cart' && <Cart cart={cart} total={cartTotal} updateQty={updateQty} setCart={setCart} />}
        {tab === 'garage' && <Garage garage={garage} setGarage={setGarage} />}
        {tab === 'profile' && <Profile alerts={alerts} garage={garage} setTab={setTab} />}
      </View>

      <View style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Tab label="Ana" icon="⌂" active={tab === 'home'} onPress={() => setTab('home')} />
        <Tab label="Mağaza" icon="◈" active={tab === 'shop'} onPress={() => setTab('shop')} />
        <Tab label={`Sepet${cartCount ? ` ${cartCount}` : ''}`} icon="▤" active={tab === 'cart'} onPress={() => setTab('cart')} />
        <Tab label="Garaj" icon="▣" active={tab === 'garage'} onPress={() => setTab('garage')} />
        <Tab label="Hesabım" icon="○" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>

      <ToolModal tool={tool} onClose={() => setTool(null)} products={products} compare={compare} setCompare={setCompare} alerts={alerts} setAlerts={setAlerts} addToCart={addToCart} />
    </View>
  );
}

function Home({ products, loading, openTool, setTab, addToCart }) {
  const liveStock = products.reduce((s, p) => s + Number(p.stock || 0), 0);
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.badge}><Text style={styles.badgeText}>TOPRAK ONE • 0.3</Text></View>
        <Text style={styles.eyebrow}>CANLI LASTİK PLATFORMU</Text>
        <Text style={styles.heroTitle}>Stoktan seç.{`\n`}Sepete ekle. <Text style={styles.gold}>Güvenle öde.</Text></Text>
        <Text style={styles.heroText}>Toprak Grup canlı ürün ve stok sistemine bağlı mobil deneyim.</Text>
        <View style={styles.stats}>
          <Stat value={loading ? '...' : String(liveStock)} label="CANLI STOK" />
          <Stat value={loading ? '...' : String(new Set(products.map(p => p.brand)).size)} label="MARKA" />
          <Stat value="AI" label="ÖNERİ" />
        </View>
      </View>

      <SectionTitle title="Hızlı Başla" right="4 akıllı araç" />
      <View style={styles.grid}>
        <Quick icon="◎" title="Kamerayla Tara" sub="Lastik ölçüsünü okut" onPress={() => openTool('camera')} />
        <Quick icon="AI" title="Akıllı Danışman" sub="Canlı stoktan öneri al" onPress={() => openTool('finder')} />
        <Quick icon="↕" title="Karşılaştır" sub="Ürünleri yan yana gör" onPress={() => openTool('compare')} />
        <Quick icon="⚡" title="Fiyat Alarmı" sub="Takip listene ekle" onPress={() => openTool('alert')} />
      </View>

      <Pressable style={styles.scanBanner} onPress={() => setTab('shop')}>
        <View style={styles.scanIcon}><Text style={styles.scanIconText}>◈</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scanTitle}>Canlı mağazayı aç</Text>
          <Text style={styles.muted}>Güncel fiyat ve stokları görüntüle.</Text>
        </View>
        <Text style={styles.chev}>›</Text>
      </Pressable>

      <SectionTitle title="Canlı Öneriler" right="Tümünü gör" onRight={() => setTab('shop')} />
      {loading ? <ActivityIndicator color={GOLD} /> : products.filter(p => Number(p.stock || 0) > 0).slice(0, 3).map(p => <ProductCard key={p.id} p={p} onAdd={() => addToCart(p)} />)}
    </ScrollView>
  );
}

function Shop({ query, setQuery, products, loading, addToCart, compare, setCompare, alerts, setAlerts }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>CANLI MAĞAZA</Text>
      <Text style={styles.pageTitle}>Doğru lastiği bul.</Text>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="205/55 R16, Michelin..." placeholderTextColor="#666" />
      </View>
      {loading && <ActivityIndicator color={GOLD} style={{ marginTop: 30 }} />}
      {!loading && products.length === 0 && <Text style={styles.pageText}>Aramana uygun stoklu ürün bulunamadı.</Text>}
      {products.map(p => (
        <ProductCard
          key={p.id}
          p={p}
          onAdd={() => addToCart(p)}
          selected={compare.includes(p.id)}
          onCompare={() => setCompare(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)}
          alerting={alerts.includes(p.id)}
          onAlert={() => setAlerts(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
        />
      ))}
    </ScrollView>
  );
}

function Cart({ cart, total, updateQty, setCart }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.eyebrow}>SEPETİM</Text>
      <Text style={styles.pageTitle}>{cart.length ? 'Siparişe hazırsın.' : 'Sepetin boş.'}</Text>
      {cart.map(p => (
        <View key={p.id} style={styles.cartRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuText}>{p.brand} {p.model}</Text>
            <Text style={styles.muted}>{sizeOf(p)} • {money(effectivePrice(p))}</Text>
          </View>
          <Pressable style={styles.qtyBtn} onPress={() => updateQty(p.id, -1)}><Text style={styles.qtyText}>−</Text></Pressable>
          <Text style={styles.qtyValue}>{p.qty}</Text>
          <Pressable style={styles.qtyBtn} onPress={() => updateQty(p.id, 1)}><Text style={styles.qtyText}>+</Text></Pressable>
        </View>
      ))}
      {!!cart.length && <>
        <View style={styles.totalRow}><Text style={styles.menuText}>Toplam</Text><Text style={styles.totalText}>{money(total)}</Text></View>
        <GoldButton label="Güvenli Ödemeye Geç" onPress={() => setCheckoutOpen(true)} />
        <Pressable onPress={() => setCart([])}><Text style={styles.clearText}>Sepeti temizle</Text></Pressable>
      </>}
      <CheckoutModal visible={checkoutOpen} onClose={() => setCheckoutOpen(false)} cart={cart} />
    </ScrollView>
  );
}

function CheckoutModal({ visible, onClose, cart }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);

  const checkout = async () => {
    if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) return Alert.alert('Eksik bilgi', 'Ad soyad, telefon, şehir ve adres zorunlu.');
    setBusy(true);
    try {
      const payload = {
        items: cart.map(x => ({ product_id: String(x.id), qty: x.qty })),
        origin_url: SITE,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        zip_code: '00000',
        note: 'Toprak One mobil uygulama siparişi',
      };
      const r = await fetch(`${API}/payments/iyzico/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || 'Ödeme oluşturulamadı');
      const url = data.checkout_url || data.payment_page_url;
      if (!url) throw new Error('Ödeme bağlantısı alınamadı');
      await Linking.openURL(url);
      onClose();
    } catch (e) {
      Alert.alert('Ödeme hatası', String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top','bottom']}>
        <View style={styles.modalHead}><Text style={styles.modalTitle}>Teslimat ve Ödeme</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.pageText}>Bilgilerini gir. Ardından İyzico güvenli ödeme ekranı açılacak.</Text>
          <Field value={name} setValue={setName} placeholder="Ad Soyad" />
          <Field value={phone} setValue={setPhone} placeholder="Telefon" keyboardType="phone-pad" />
          <Field value={email} setValue={setEmail} placeholder="E-posta" keyboardType="email-address" />
          <Field value={city} setValue={setCity} placeholder="Şehir" />
          <Field value={address} setValue={setAddress} placeholder="Açık adres" multiline />
          <GoldButton label={busy ? 'Ödeme hazırlanıyor...' : 'İyzico ile Öde'} onPress={busy ? () => {} : checkout} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Garage({ garage, setGarage }) {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const add = () => {
    if (!brand.trim() || !model.trim()) return Alert.alert('Eksik bilgi', 'Marka ve model gir.');
    setGarage(prev => [...prev, { id: Date.now(), brand: brand.trim(), model: model.trim(), year: year.trim() }]);
    setBrand(''); setModel(''); setYear('');
  };
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.eyebrow}>BENİM GARAJIM</Text><Text style={styles.pageTitle}>Aracını kaydet.</Text>
      <Field value={brand} setValue={setBrand} placeholder="Marka" />
      <Field value={model} setValue={setModel} placeholder="Model" />
      <Field value={year} setValue={setYear} placeholder="Yıl" keyboardType="numeric" />
      <GoldButton label="Aracı Garaja Ekle" onPress={add} />
      {garage.map(v => <View key={v.id} style={styles.menuRow}><Text style={styles.menuText}>{v.brand} {v.model} {v.year}</Text><Text style={styles.gold}>Kayıtlı</Text></View>)}
    </ScrollView>
  );
}

function Profile({ alerts, garage, setTab }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.eyebrow}>HESABIM</Text><Text style={styles.pageTitle}>Toprak One.</Text>
      <View style={styles.summaryWrap}>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{garage.length}</Text><Text style={styles.muted}>Araç</Text></View>
        <View style={styles.summaryCard}><Text style={styles.summaryValue}>{alerts.length}</Text><Text style={styles.muted}>Alarm</Text></View>
      </View>
      <Pressable style={styles.menuRow} onPress={() => setTab('cart')}><Text style={styles.menuText}>Sepetim</Text><Text style={styles.chev}>›</Text></Pressable>
      <Pressable style={styles.menuRow} onPress={() => Linking.openURL(`${SITE}/hesabim/kargo`)}><Text style={styles.menuText}>Sipariş / Kargo Takibi</Text><Text style={styles.chev}>›</Text></Pressable>
      <Pressable style={styles.menuRow} onPress={() => Linking.openURL(`${SITE}/iletisim`)}><Text style={styles.menuText}>Destek</Text><Text style={styles.chev}>›</Text></Pressable>
      <Pressable style={styles.menuRow} onPress={() => Linking.openURL(`${SITE}/gizlilik-politikasi`)}><Text style={styles.menuText}>Gizlilik</Text><Text style={styles.chev}>›</Text></Pressable>
    </ScrollView>
  );
}

function ToolModal({ tool, onClose, products, compare, setCompare, alerts, setAlerts, addToCart }) {
  return (
    <Modal visible={!!tool} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top','bottom']}>
        <View style={styles.modalHead}><Text style={styles.modalTitle}>{tool === 'camera' ? 'Kamerayla Tara' : tool === 'finder' ? 'Akıllı Danışman' : tool === 'compare' ? 'Karşılaştır' : 'Fiyat Alarmı'}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
        {tool === 'camera' && <CameraTool />}
        {tool === 'finder' && <FinderTool products={products} addToCart={addToCart} />}
        {tool === 'compare' && <CompareTool products={products} compare={compare} setCompare={setCompare} />}
        {tool === 'alert' && <AlertTool products={products} alerts={alerts} setAlerts={setAlerts} />}
      </SafeAreaView>
    </Modal>
  );
}

function CameraTool() {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef(null);
  const [captured, setCaptured] = useState(false);
  if (!permission) return <View style={styles.center}><ActivityIndicator color={GOLD} /></View>;
  if (!permission.granted) return <View style={styles.center}><Text style={styles.pageText}>Lastik yanağındaki ölçüyü taramak için kamera izni gerekli.</Text><GoldButton label="Kamera İzni Ver" onPress={requestPermission} /></View>;
  const shoot = async () => { try { await ref.current?.takePictureAsync({ quality: 0.5 }); setCaptured(true); } catch { Alert.alert('Kamera', 'Fotoğraf alınamadı.'); } };
  return <View style={{ flex: 1 }}><CameraView ref={ref} style={styles.camera} facing="back" /><View style={styles.cameraOverlay}><Text style={styles.cameraHint}>205/55 R16 gibi ebat yazısını çerçeveye al.</Text></View><Pressable style={styles.shutter} onPress={shoot}><View style={styles.shutterInner} /></Pressable>{captured && <View style={styles.notice}><Text style={styles.noticeText}>Fotoğraf alındı. Otomatik OCR servisi sonraki sürümde bu görüntüden ebat okuyacak.</Text></View>}</View>;
}

function FinderTool({ products, addToCart }) {
  const [size, setSize] = useState('205/55 R16');
  const [need, setNeed] = useState('Kış');
  const [budget, setBudget] = useState('');
  const [results, setResults] = useState([]);
  const find = () => {
    const match = size.toUpperCase().match(/(\d{3})\s*\/\s*(\d{2,3})\s*R\s*(\d{2})/);
    const maxBudget = Number(String(budget).replace(/\D/g, '')) || Infinity;
    const wantedSeason = need === 'Kış' ? 'winter' : need === 'Yaz' ? 'summer' : 'all_season';
    const list = products
      .filter(p => Number(p.stock || 0) > 0)
      .filter(p => !match || (Number(p.width) === Number(match[1]) && Number(p.profile) === Number(match[2]) && Number(p.rim) === Number(match[3])))
      .filter(p => p.season === wantedSeason)
      .filter(p => effectivePrice(p) <= maxBudget)
      .sort((a, b) => effectivePrice(a) - effectivePrice(b))
      .slice(0, 3);
    setResults(list);
  };
  return <ScrollView contentContainerStyle={styles.modalContent}><Text style={styles.pageText}>Ebat, mevsim ve bütçeni yaz. Danışman canlı stoktan en uygun seçenekleri çıkarır.</Text><Field value={size} setValue={setSize} placeholder="205/55 R16" /><View style={styles.row}>{['Kış','Yaz','4 Mevsim'].map(x => <Pressable key={x} style={[styles.chip, need === x && styles.chipActive]} onPress={() => setNeed(x)}><Text style={[styles.chipText, need === x && styles.chipTextActive]}>{x}</Text></Pressable>)}</View><Field value={budget} setValue={setBudget} placeholder="Maksimum bütçe (opsiyonel)" keyboardType="numeric" /><GoldButton label="Canlı Stoktan Öner" onPress={find} />{results.length === 0 ? <Text style={styles.muted}>Arama yaptıktan sonra uygun ürünler burada görünecek.</Text> : results.map(p => <ProductCard key={p.id} p={p} onAdd={() => addToCart(p)} />)}</ScrollView>;
}

function CompareTool({ products, compare, setCompare }) {
  const available = products.filter(p => Number(p.stock || 0) > 0).slice(0, 20);
  const chosen = products.filter(p => compare.includes(p.id));
  return <ScrollView contentContainerStyle={styles.modalContent}><Text style={styles.pageText}>En fazla 3 canlı ürünü seç.</Text>{available.map(p => <Pressable key={p.id} style={[styles.selectRow, compare.includes(p.id) && styles.selectRowActive]} onPress={() => setCompare(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)}><View style={{ flex: 1 }}><Text style={styles.menuText}>{p.brand} {p.model}</Text><Text style={styles.muted}>{sizeOf(p)} • {money(effectivePrice(p))}</Text></View><Text style={styles.gold}>{compare.includes(p.id) ? 'Seçildi' : '+'}</Text></Pressable>)}{chosen.length > 0 && <View style={styles.compareBox}>{chosen.map(p => <View key={p.id} style={styles.compareItem}><Text style={styles.compareBrand}>{p.brand}</Text><Text style={styles.muted}>{p.model}</Text><Text style={styles.gold}>{money(effectivePrice(p))}</Text><Text style={styles.muted}>Stok: {p.stock}</Text></View>)}</View>}</ScrollView>;
}

function AlertTool({ products, alerts, setAlerts }) {
  const available = products.filter(p => Number(p.stock || 0) > 0).slice(0, 25);
  return <ScrollView contentContainerStyle={styles.modalContent}><Text style={styles.pageText}>Takip etmek istediğin ürünü seç. Bildirim altyapısı eklendiğinde bu liste fiyat düşüşlerinde kullanılacak.</Text>{available.map(p => <Pressable key={p.id} style={[styles.selectRow, alerts.includes(p.id) && styles.selectRowActive]} onPress={() => setAlerts(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}><View style={{ flex: 1 }}><Text style={styles.menuText}>{p.brand} {p.model}</Text><Text style={styles.muted}>{sizeOf(p)} • {money(effectivePrice(p))}</Text></View><Text style={styles.gold}>{alerts.includes(p.id) ? 'Takipte' : 'Ekle'}</Text></Pressable>)}</ScrollView>;
}

function ProductCard({ p, onAdd, onCompare, selected, onAlert, alerting }) {
  return <View style={styles.productCard}><View style={styles.tire}><Text style={styles.tireText}>R{p.rim || '?'}</Text></View><View style={{ flex: 1 }}><Text style={styles.productBrand}>{p.brand}</Text><Text style={styles.productName}>{p.model}</Text><Text style={styles.muted}>{sizeOf(p)} • {seasonTr(p.season)} • Stok {p.stock}</Text><Text style={styles.price}>{money(effectivePrice(p))}</Text><View style={styles.productActions}>{onAdd && <Pressable style={styles.miniGold} onPress={onAdd}><Text style={styles.miniGoldText}>Sepete Ekle</Text></Pressable>}{onCompare && <Pressable style={styles.miniDark} onPress={onCompare}><Text style={styles.miniDarkText}>{selected ? '✓' : '↕'}</Text></Pressable>}{onAlert && <Pressable style={styles.miniDark} onPress={onAlert}><Text style={styles.miniDarkText}>{alerting ? '⚡' : '☆'}</Text></Pressable>}</View></View></View>;
}

function Field({ value, setValue, placeholder, keyboardType, multiline }) {
  return <TextInput style={[styles.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]} value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor="#666" keyboardType={keyboardType} multiline={multiline} autoCapitalize="none" />;
}

function Tab({ label, icon, active, onPress }) { return <Pressable style={styles.tab} onPress={onPress}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text numberOfLines={1} style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text></Pressable>; }
function Stat({ value, label }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Quick({ icon, title, sub, onPress }) { return <Pressable style={styles.quick} onPress={onPress}><View style={styles.quickIcon}><Text style={styles.quickIconText}>{icon}</Text></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.muted}>{sub}</Text></Pressable>; }
function SectionTitle({ title, right, onRight }) { return <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onRight}><Text style={styles.sectionRight}>{right}</Text></Pressable></View>; }
function GoldButton({ label, onPress }) { return <Pressable style={styles.goldButton} onPress={onPress}><Text style={styles.goldButtonText}>{label}</Text></Pressable>; }

export default function App() { return <SafeAreaProvider><Shell /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG }, safeTop: { backgroundColor: BG }, body: { flex: 1 }, gold: { color: GOLD },
  topbar: { height: 64, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#171717', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1.5 }, logoSub: { color: '#666', fontSize: 8, letterSpacing: 2.5, marginTop: 2 },
  cartBadge: { backgroundColor: '#16130d', borderWidth: 1, borderColor: '#473714', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20 }, cartBadgeText: { color: GOLD, fontWeight: '800' },
  offlineBar: { backgroundColor: '#3a2608', padding: 8, alignItems: 'center' }, offlineText: { color: '#f0c56d', fontSize: 12, fontWeight: '700' },
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 130 },
  hero: { minHeight: 310, borderRadius: 28, borderWidth: 1, borderColor: '#272727', backgroundColor: CARD, padding: 22, overflow: 'hidden', justifyContent: 'flex-end' }, heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#3b2a0a', opacity: .72, right: -70, top: -80 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#211b0d', borderWidth: 1, borderColor: '#4e3a12', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 18 }, badgeText: { color: GOLD, fontSize: 9, letterSpacing: 1.6, fontWeight: '800' },
  eyebrow: { color: '#8b8b8b', fontSize: 11, letterSpacing: 2.2, fontWeight: '800', marginBottom: 10 }, heroTitle: { color: '#fff', fontSize: 31, lineHeight: 38, fontWeight: '900' }, heroText: { color: '#9b9b9b', fontSize: 14, lineHeight: 22, marginTop: 14 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2a2a2a', marginTop: 22, paddingTop: 18 }, stat: { flex: 1 }, statValue: { color: '#fff', fontSize: 21, fontWeight: '900' }, statLabel: { color: '#666', fontSize: 8, letterSpacing: 1.6, marginTop: 5 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 14 }, sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '900' }, sectionRight: { color: '#777', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, quick: { width: '48.5%', minHeight: 135, backgroundColor: CARD, borderWidth: 1, borderColor: '#242424', borderRadius: 22, padding: 16, marginBottom: 12 }, quickIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#211b0d', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, quickIconText: { color: GOLD, fontWeight: '900' }, quickTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 5 }, muted: { color: '#747474', fontSize: 12, lineHeight: 18 },
  scanBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#15120c', borderWidth: 1, borderColor: '#493814', borderRadius: 22, padding: 14, marginTop: 6 }, scanIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, scanIconText: { color: '#111', fontSize: 22, fontWeight: '900' }, scanTitle: { color: '#fff', fontWeight: '900', fontSize: 15 }, chev: { color: '#777', fontSize: 27 },
  pageTitle: { color: '#fff', fontSize: 29, fontWeight: '900', marginBottom: 18 }, pageText: { color: '#aaa', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderWidth: 1, borderColor: '#262626', borderRadius: 18, paddingHorizontal: 14, marginBottom: 18 }, searchIcon: { color: GOLD, fontSize: 22, marginRight: 8 }, searchInput: { flex: 1, color: '#fff', height: 52 },
  productCard: { flexDirection: 'row', gap: 14, backgroundColor: CARD, borderWidth: 1, borderColor: '#242424', borderRadius: 22, padding: 14, marginBottom: 12 }, tire: { width: 74, height: 74, borderRadius: 37, borderWidth: 12, borderColor: '#2e2e2e', alignItems: 'center', justifyContent: 'center', marginTop: 4 }, tireText: { color: GOLD, fontWeight: '900', fontSize: 11 }, productBrand: { color: GOLD, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, productName: { color: '#fff', fontSize: 16, fontWeight: '900', marginVertical: 4 }, price: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 7 }, productActions: { flexDirection: 'row', gap: 7, marginTop: 10 }, miniGold: { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, miniGoldText: { color: '#111', fontWeight: '900', fontSize: 11 }, miniDark: { backgroundColor: '#1c1c1c', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: '#303030' }, miniDarkText: { color: '#ddd', fontWeight: '900' },
  tabbar: { flexDirection: 'row', backgroundColor: '#0d0d0d', borderTopWidth: 1, borderTopColor: '#222', paddingTop: 8 }, tab: { flex: 1, alignItems: 'center', minWidth: 0 }, tabIcon: { color: '#666', fontSize: 19 }, tabLabel: { color: '#666', fontSize: 9, marginTop: 3 }, tabActive: { color: GOLD },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: CARD, borderWidth: 1, borderColor: '#242424', borderRadius: 18, padding: 14, marginBottom: 10 }, qtyBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1d1d1d', alignItems: 'center', justifyContent: 'center' }, qtyText: { color: GOLD, fontSize: 20, fontWeight: '900' }, qtyValue: { color: '#fff', minWidth: 20, textAlign: 'center', fontWeight: '900' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 }, totalText: { color: GOLD, fontSize: 24, fontWeight: '900' }, clearText: { color: '#777', textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
  goldButton: { backgroundColor: GOLD, paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginVertical: 10 }, goldButtonText: { color: '#111', fontWeight: '900', fontSize: 14 }, input: { backgroundColor: CARD, borderWidth: 1, borderColor: '#2b2b2b', color: '#fff', borderRadius: 15, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10 },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD, borderWidth: 1, borderColor: '#242424', borderRadius: 16, padding: 15, marginBottom: 9 }, menuText: { color: '#fff', fontSize: 14, fontWeight: '800' }, summaryWrap: { flexDirection: 'row', gap: 10, marginBottom: 14 }, summaryCard: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: '#242424', borderRadius: 18, padding: 16 }, summaryValue: { color: GOLD, fontWeight: '900', fontSize: 25 },
  modalSafe: { flex: 1, backgroundColor: BG }, modalHead: { height: 66, borderBottomWidth: 1, borderBottomColor: '#202020', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }, modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900' }, close: { color: '#aaa', fontSize: 34 }, modalContent: { padding: 18, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 }, chip: { flex: 1, borderWidth: 1, borderColor: '#333', borderRadius: 14, alignItems: 'center', paddingVertical: 12 }, chipActive: { backgroundColor: '#241d0c', borderColor: '#6b5018' }, chipText: { color: '#888', fontWeight: '700', fontSize: 12 }, chipTextActive: { color: GOLD },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 15, padding: 14, marginBottom: 8, backgroundColor: CARD }, selectRowActive: { borderColor: GOLD, backgroundColor: '#17130b' }, compareBox: { marginTop: 12, backgroundColor: '#0e0e0e', borderRadius: 18, borderWidth: 1, borderColor: '#2b2b2b', padding: 12 }, compareItem: { borderBottomWidth: 1, borderBottomColor: '#222', paddingVertical: 10 }, compareBrand: { color: '#fff', fontWeight: '900', fontSize: 15 },
  camera: { flex: 1 }, cameraOverlay: { position: 'absolute', left: 28, right: 28, top: 70, borderWidth: 2, borderColor: GOLD, borderRadius: 22, height: 160, alignItems: 'center', justifyContent: 'flex-end', padding: 12 }, cameraHint: { color: '#fff', backgroundColor: '#0009', padding: 8, borderRadius: 9, textAlign: 'center' }, shutter: { position: 'absolute', bottom: 28, alignSelf: 'center', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: GOLD }, notice: { position: 'absolute', left: 18, right: 18, bottom: 120, backgroundColor: '#111e', borderRadius: 14, padding: 12 }, noticeText: { color: '#ddd', textAlign: 'center', fontSize: 12 },
});
