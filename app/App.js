import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

const products = [
  { id: 1, brand: 'Michelin', name: 'Alpin 7', size: '205/55 R16', price: 4890, score: 9.4, season: 'Kış' },
  { id: 2, brand: 'Bridgestone', name: 'Blizzak 6', size: '205/55 R16', price: 4650, score: 9.1, season: 'Kış' },
  { id: 3, brand: 'Lassa', name: 'Snoways 4', size: '195/65 R15', price: 3190, score: 8.8, season: 'Kış' },
];

const quickActions = [
  { icon: '◉', title: 'Kamerayla Tara', subtitle: 'Lastik ölçüsünü okut' },
  { icon: 'AI', title: 'Akıllı Bulucu', subtitle: 'Aracına en uygunu bul' },
  { icon: '↕', title: 'Karşılaştır', subtitle: 'Fiyat ve performans' },
  { icon: '⚡', title: 'Fiyat Alarmı', subtitle: 'Düşünce haber ver' },
];

function formatPrice(v) {
  return new Intl.NumberFormat('tr-TR').format(v) + ' ₺';
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [query, setQuery] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantText, setAssistantText] = useState('');
  const pulse = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.brand} ${p.name} ${p.size}`.toLowerCase().includes(q));
  }, [query]);

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.hero, { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}> 
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.badge}><Text style={styles.badgeText}>TOPRAK ONE • BETA</Text></View>
        <Text style={styles.heroEyebrow}>AKILLI SÜRÜŞ ASİSTANI</Text>
        <Text style={styles.heroTitle}>Lastiğini sadece alma.{'\n'}Doğru lastiği <Text style={styles.gold}>seç.</Text></Text>
        <Text style={styles.heroText}>Araç bilgini gir, lastiğini kamerayla okut veya yapay zekâya sor. Toprak One sana en doğru seçeneği birkaç saniyede çıkarsın.</Text>

        <View style={styles.heroStats}>
          <View><Text style={styles.statValue}>5.000+</Text><Text style={styles.statLabel}>Stok</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={styles.statValue}>7</Text><Text style={styles.statLabel}>Marka</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={styles.statValue}>AI</Text><Text style={styles.statLabel}>Öneri</Text></View>
        </View>
      </Animated.View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Hızlı Başla</Text>
        <Text style={styles.sectionMeta}>4 akıllı araç</Text>
      </View>

      <View style={styles.quickGrid}>
        {quickActions.map((item, index) => (
          <Pressable key={item.title} style={styles.quickCard} onPress={() => index === 1 ? setAssistantOpen(true) : null}>
            <View style={styles.quickIcon}><Text style={styles.quickIconText}>{item.icon}</Text></View>
            <Text style={styles.quickTitle}>{item.title}</Text>
            <Text style={styles.quickSubtitle}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.scanBanner}>
        <Animated.View style={[styles.scanPulse, { opacity: pulse.interpolate({ inputRange: [0,1], outputRange: [0.25,0.75] }), transform: [{ scale: pulse.interpolate({ inputRange: [0,1], outputRange: [1,1.25] }) }] }]} />
        <View style={styles.scanIcon}><Text style={styles.scanIconText}>◎</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scanTitle}>Kamerayı lastiğe tut</Text>
          <Text style={styles.scanText}>205/55 R16 gibi ölçüyü otomatik okuyalım.</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bugünün Önerileri</Text>
        <Pressable onPress={() => setTab('shop')}><Text style={styles.link}>Tümünü gör</Text></Pressable>
      </View>

      {products.slice(0,2).map((p, i) => <ProductCard key={p.id} p={p} featured={i === 0} />)}

      <View style={styles.aiCard}>
        <View style={styles.aiOrb}><Text style={styles.aiOrbText}>AI</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.aiTitle}>Toprak AI hazır</Text>
          <Text style={styles.aiText}>“Van’da kış için sessiz ve güvenli lastik öner” gibi yaz.</Text>
        </View>
        <Pressable style={styles.smallButton} onPress={() => setAssistantOpen(true)}><Text style={styles.smallButtonText}>Sor</Text></Pressable>
      </View>
    </ScrollView>
  );

  const renderShop = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageKicker}>AKILLI MAĞAZA</Text>
      <Text style={styles.pageTitle}>Doğru lastiği bul.</Text>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Örn. 205/55 R16 Michelin" placeholderTextColor="#6e6e73" style={styles.searchInput} />
      </View>
      <View style={styles.chips}>
        {['Kış','Yaz','4 Mevsim','Michelin'].map(x => <Pressable key={x} style={styles.chip}><Text style={styles.chipText}>{x}</Text></Pressable>)}
      </View>
      {filtered.map((p, i) => <ProductCard key={p.id} p={p} featured={i === 0} />)}
    </ScrollView>
  );

  const renderGarage = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.pageKicker}>BENİM GARAJIM</Text>
      <Text style={styles.pageTitle}>Aracını tanıtalım.</Text>
      <Text style={styles.pageText}>Aracını kaydettiğinde Toprak One doğru ebatı, mevsimi ve uygun lastikleri otomatik filtreleyecek.</Text>
      <View style={styles.garageCard}>
        <Text style={styles.garageIcon}>＋</Text>
        <Text style={styles.garageTitle}>Araç Ekle</Text>
        <Text style={styles.garageText}>Marka • Model • Yıl • Motor</Text>
      </View>
      <View style={styles.infoCard}><Text style={styles.infoTitle}>Akıllı hatırlatmalar</Text><Text style={styles.infoText}>Mevsim değişimi, lastik yaşı ve fiyat düşüşü gibi önemli anlarda seni bilgilendireceğiz.</Text></View>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.pageKicker}>HESABIM</Text>
      <Text style={styles.pageTitle}>Toprak One üyeliği.</Text>
      {['Siparişlerim','Favorilerim','Fiyat Alarmlarım','Garajım','Destek'].map(item => (
        <Pressable key={item} style={styles.menuRow}><Text style={styles.menuText}>{item}</Text><Text style={styles.arrow}>›</Text></Pressable>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#080808" />
      <View style={styles.topbar}>
        <View>
          <Text style={styles.logo}>TOPRAK<Text style={styles.gold}>ONE</Text></Text>
          <Text style={styles.logoSub}>GLOBAL MOBILITY</Text>
        </View>
        <Pressable style={styles.avatar}><Text style={styles.avatarText}>ET</Text></Pressable>
      </View>

      <View style={styles.content}>
        {tab === 'home' && renderHome()}
        {tab === 'shop' && renderShop()}
        {tab === 'garage' && renderGarage()}
        {tab === 'profile' && renderProfile()}
      </View>

      <View style={styles.tabbar}>
        <Tab icon="⌂" label="Ana Sayfa" active={tab === 'home'} onPress={() => setTab('home')} />
        <Tab icon="◈" label="Mağaza" active={tab === 'shop'} onPress={() => setTab('shop')} />
        <Tab icon="▣" label="Garaj" active={tab === 'garage'} onPress={() => setTab('garage')} />
        <Tab icon="○" label="Hesabım" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>

      {assistantOpen && (
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBackdrop} onPress={() => setAssistantOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={styles.aiOrb}><Text style={styles.aiOrbText}>AI</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.sheetTitle}>Toprak AI</Text><Text style={styles.sheetSub}>Lastik danışmanın</Text></View>
              <Pressable onPress={() => setAssistantOpen(false)}><Text style={styles.close}>×</Text></Pressable>
            </View>
            <View style={styles.chatBubble}><Text style={styles.chatText}>Merhaba. Aracını, lastik ölçünü veya beklentini yaz. Sana fiyat, güvenlik ve konfor dengesine göre seçenek çıkarayım.</Text></View>
            <View style={styles.promptRow}>
              <TextInput value={assistantText} onChangeText={setAssistantText} placeholder="Örn. 205/55 R16 kış lastiği..." placeholderTextColor="#777" style={styles.promptInput} />
              <Pressable style={styles.send}><Text style={styles.sendText}>↑</Text></Pressable>
            </View>
            <Text style={styles.betaNote}>İlk sürümde arayüz aktif. Gerçek AI bağlantısı bir sonraki aşamada eklenecek.</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function ProductCard({ p, featured }) {
  return (
    <View style={[styles.productCard, featured && styles.productCardFeatured]}>
      <View style={styles.productVisual}>
        <View style={styles.tireOuter}><View style={styles.tireInner}><Text style={styles.tireText}>{p.size.split(' ')[1] || 'R16'}</Text></View></View>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.productTop}><Text style={styles.productBrand}>{p.brand}</Text><Text style={styles.score}>★ {p.score}</Text></View>
        <Text style={styles.productName}>{p.name}</Text>
        <Text style={styles.productSize}>{p.size} • {p.season}</Text>
        <View style={styles.productBottom}><Text style={styles.price}>{formatPrice(p.price)}</Text><Pressable style={styles.add}><Text style={styles.addText}>+</Text></Pressable></View>
      </View>
    </View>
  );
}

function Tab({ icon, label, active, onPress }) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
      {active && <View style={styles.tabDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080808' },
  content: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 120 },
  topbar: { height: 68, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#171717' },
  logo: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1.4 },
  logoSub: { color: '#646464', fontSize: 8, letterSpacing: 2.4, marginTop: 2 },
  gold: { color: '#D9A441' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#151515', borderWidth: 1, borderColor: '#2e2e2e', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#D9A441', fontWeight: '800', fontSize: 11 },
  hero: { marginTop: 16, minHeight: 330, borderRadius: 28, backgroundColor: '#111', borderWidth: 1, borderColor: '#242424', padding: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroGlowOne: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#3b2a0a', opacity: .72, top: -80, right: -70 },
  heroGlowTwo: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff', opacity: .035, bottom: 20, right: 20 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#211b0d', borderWidth: 1, borderColor: '#4e3a12', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginBottom: 18 },
  badgeText: { color: '#D9A441', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  heroEyebrow: { color: '#8c8c8c', fontSize: 10, letterSpacing: 2.2, fontWeight: '700', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2 },
  heroText: { color: '#a4a4a4', fontSize: 13, lineHeight: 19, marginTop: 12, maxWidth: width - 88 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#686868', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#292929', marginHorizontal: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: '#f7f7f7', fontSize: 18, fontWeight: '800' },
  sectionMeta: { color: '#646464', fontSize: 11 },
  link: { color: '#D9A441', fontSize: 12, fontWeight: '700' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: { width: (width - 46) / 2, backgroundColor: '#111', borderRadius: 20, borderWidth: 1, borderColor: '#202020', padding: 16, minHeight: 132 },
  quickIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1e190d', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  quickIconText: { color: '#D9A441', fontSize: 13, fontWeight: '900' },
  quickTitle: { color: '#eee', fontWeight: '800', fontSize: 13 },
  quickSubtitle: { color: '#666', fontSize: 10, marginTop: 5 },
  scanBanner: { marginTop: 14, borderRadius: 22, backgroundColor: '#15120b', borderWidth: 1, borderColor: '#3b3016', padding: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  scanPulse: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: '#D9A441', left: 7 },
  scanIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#D9A441', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  scanIconText: { color: '#090909', fontSize: 24, fontWeight: '900' },
  scanTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  scanText: { color: '#8c826b', fontSize: 10, marginTop: 4 },
  arrow: { color: '#777', fontSize: 28, fontWeight: '300' },
  productCard: { flexDirection: 'row', backgroundColor: '#101010', borderWidth: 1, borderColor: '#202020', borderRadius: 22, padding: 14, marginBottom: 10 },
  productCardFeatured: { borderColor: '#413313', backgroundColor: '#12110e' },
  productVisual: { width: 92, height: 112, alignItems: 'center', justifyContent: 'center' },
  tireOuter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#252525', borderWidth: 8, borderColor: '#303030', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
  tireInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0c0c0c', borderWidth: 4, borderColor: '#4a4a4a', alignItems: 'center', justifyContent: 'center' },
  tireText: { color: '#686868', fontSize: 8, fontWeight: '800' },
  productTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productBrand: { color: '#D9A441', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  score: { color: '#858585', fontSize: 9 },
  productName: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 6 },
  productSize: { color: '#707070', fontSize: 10, marginTop: 4 },
  productBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  price: { color: '#fff', fontSize: 16, fontWeight: '900' },
  add: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#D9A441', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#070707', fontWeight: '900', fontSize: 19 },
  aiCard: { marginTop: 8, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: '#242424', backgroundColor: '#111', flexDirection: 'row', alignItems: 'center' },
  aiOrb: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#D9A441', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  aiOrbText: { color: '#080808', fontSize: 11, fontWeight: '900' },
  aiTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  aiText: { color: '#747474', fontSize: 10, lineHeight: 14, marginTop: 3 },
  smallButton: { backgroundColor: '#1b1b1b', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  smallButtonText: { color: '#D9A441', fontSize: 11, fontWeight: '800' },
  pageKicker: { color: '#D9A441', fontSize: 10, letterSpacing: 2, fontWeight: '800', marginTop: 24 },
  pageTitle: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -1.1, marginTop: 7 },
  pageText: { color: '#777', fontSize: 13, lineHeight: 20, marginTop: 10 },
  searchBox: { height: 54, borderRadius: 18, borderWidth: 1, borderColor: '#232323', backgroundColor: '#111', marginTop: 20, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
  searchIcon: { color: '#777', fontSize: 22, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, backgroundColor: '#121212', borderWidth: 1, borderColor: '#252525' },
  chipText: { color: '#aaa', fontSize: 10, fontWeight: '700' },
  garageCard: { marginTop: 24, height: 190, borderRadius: 26, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3b3016', backgroundColor: '#11100c', alignItems: 'center', justifyContent: 'center' },
  garageIcon: { color: '#D9A441', fontSize: 38, fontWeight: '200' },
  garageTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8 },
  garageText: { color: '#666', fontSize: 10, marginTop: 4 },
  infoCard: { padding: 18, borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#202020', marginTop: 14 },
  infoTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  infoText: { color: '#717171', fontSize: 11, lineHeight: 17, marginTop: 6 },
  menuRow: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1b1b1b' },
  menuText: { color: '#ddd', fontSize: 14, fontWeight: '700' },
  tabbar: { height: 74, flexDirection: 'row', backgroundColor: '#0c0c0c', borderTopWidth: 1, borderTopColor: '#202020', paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { color: '#585858', fontSize: 20, marginBottom: 3 },
  tabLabel: { color: '#585858', fontSize: 9, fontWeight: '700' },
  tabActive: { color: '#D9A441' },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D9A441', position: 'absolute', bottom: 2 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.68)' },
  sheet: { backgroundColor: '#101010', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 32, borderTopWidth: 1, borderColor: '#2a2a2a' },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 18 },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  sheetSub: { color: '#666', fontSize: 10, marginTop: 2 },
  close: { color: '#666', fontSize: 28, paddingHorizontal: 6 },
  chatBubble: { backgroundColor: '#171717', borderRadius: 18, padding: 14, marginTop: 18, borderWidth: 1, borderColor: '#242424' },
  chatText: { color: '#b3b3b3', fontSize: 12, lineHeight: 18 },
  promptRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  promptInput: { flex: 1, height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#292929', backgroundColor: '#0c0c0c', color: '#fff', paddingHorizontal: 14, fontSize: 12 },
  send: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#D9A441', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#080808', fontSize: 20, fontWeight: '900' },
  betaNote: { color: '#555', fontSize: 9, lineHeight: 13, marginTop: 12, textAlign: 'center' },
});
