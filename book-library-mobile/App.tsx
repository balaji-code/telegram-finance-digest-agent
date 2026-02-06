import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import CategorySection from './src/components/CategorySection';
import { extractBookFromCover } from './src/services/aiBookExtraction';
import { getBooks, getFolders, saveBooks, saveFolders } from './src/storage/libraryStore';
import { Book, DEFAULT_FOLDERS } from './src/types/book';

type GroupedSection = {
  category: string;
  books: Book[];
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [folders, setFolders] = useState<string[]>([...DEFAULT_FOLDERS]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [moveBook, setMoveBook] = useState<Book | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    (async () => {
      const [savedBooks, savedFolders] = await Promise.all([getBooks(), getFolders()]);
      setBooks(savedBooks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setFolders(savedFolders.includes('Other') ? savedFolders : [...savedFolders, 'Other']);
    })();
  }, []);

  const groupedBooks = useMemo<GroupedSection[]>(() => {
    const categories = Array.from(new Set([...folders, ...books.map((book) => book.category), 'Other']));

    return categories.map((category) => ({
      category,
      books: books.filter((book) => book.category === category)
    }));
  }, [books, folders]);

  const totalBooks = books.length;

  async function persistBooks(nextBooks: Book[]) {
    setBooks(nextBooks);
    await saveBooks(nextBooks);
  }

  async function persistFolders(nextFolders: string[]) {
    const normalized = Array.from(new Set([...nextFolders.map((item) => item.trim()).filter(Boolean), 'Other']));
    setFolders(normalized);
    await saveFolders(normalized);
  }

  async function scanAndAutoAddBook() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to scan book covers.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
      base64: true
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      Alert.alert('Scan failed', 'Could not read the captured image.');
      return;
    }

    setIsProcessing(true);

    const extractionResult = asset.base64
      ? await extractBookFromCover(asset.base64)
      : { ok: false as const, error: 'Captured image missing base64 payload.' };

    if (!extractionResult.ok) {
      setIsProcessing(false);
      Alert.alert(
        'AI extraction failed',
        extractionResult.error
      );
      return;
    }
    const extracted = extractionResult.data;
    const normalizedTitle = normalizeText(extracted.title);
    const normalizedAuthor = normalizeText(extracted.author || '');

    const duplicateExists = books.some((existing) => {
      const existingTitle = normalizeText(existing.title);
      if (existingTitle !== normalizedTitle) return false;

      const existingAuthor = normalizeText(existing.author || '');
      if (!normalizedAuthor || normalizedAuthor === 'unknownauthor') return true;
      if (!existingAuthor || existingAuthor === 'unknownauthor') return true;

      return existingAuthor === normalizedAuthor;
    });

    if (duplicateExists) {
      setIsProcessing(false);
      Alert.alert('Already in library', 'This book is already in your library.');
      return;
    }

    const category = extracted.category.trim() || 'Other';
    const nextFolders = folders.includes(category) ? folders : [...folders, category];
    if (!folders.includes(category)) {
      await persistFolders(nextFolders);
    }

    const book: Book = {
      id: `${Date.now()}`,
      title: extracted.title,
      author: extracted.author,
      description: extracted.description,
      coverUri: asset.uri,
      category,
      price: extracted.price || 'N/A',
      rating: extracted.rating || 'N/A',
      amazonUrl: extracted.amazonUrl || '',
      createdAt: new Date().toISOString()
    };

    const nextBooks = [book, ...books];
    await persistBooks(nextBooks);

    setIsProcessing(false);
    Alert.alert('Book added', `Saved to ${category} folder`);
  }

  async function addFolder() {
    const normalized = newFolderName.trim();
    if (!normalized) return;

    if (folders.some((folder) => folder.toLowerCase() === normalized.toLowerCase())) {
      Alert.alert('Folder exists', 'A folder with this name already exists.');
      return;
    }

    await persistFolders([...folders, normalized]);
    setNewFolderName('');
  }

  async function deleteFolder(name: string) {
    if (name === 'Other') {
      Alert.alert('Restricted', 'Other folder cannot be deleted.');
      return;
    }

    Alert.alert('Delete folder?', `Books in ${name} will be moved to Other.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const nextFolders = folders.filter((folder) => folder !== name);
          const nextBooks = books.map((book) =>
            book.category === name ? { ...book, category: 'Other' } : book
          );

          await Promise.all([persistFolders(nextFolders), persistBooks(nextBooks)]);
        }
      }
    ]);
  }

  async function moveBookToFolder(category: string) {
    if (!moveBook) return;

    const nextBooks = books.map((book) =>
      book.id === moveBook.id ? { ...book, category } : book
    );

    await persistBooks(nextBooks);
    setMoveBook(null);
  }

  function confirmDeleteBook(book: Book) {
    Alert.alert('Delete book?', `"${book.title}" will be removed from your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const nextBooks = books.filter((item) => item.id !== book.id);
          await persistBooks(nextBooks);
        }
      }
    ]);
  }

  return (
    <LinearGradient colors={['#EFDAB8', '#D8E7DF', '#CBD9EF']} style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1600&q=80' }}
        style={styles.booksBackground}
        imageStyle={styles.booksBackgroundImage}
      />
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80' }}
        style={styles.booksPatch}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appFrame}>
          <View style={styles.header}>
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1400&q=80' }}
              style={styles.heroCard}
              imageStyle={styles.heroCardImage}
            >
              <LinearGradient colors={['rgba(10,19,38,0.92)', 'rgba(17,33,65,0.50)']} style={styles.heroOverlay}>
                <View>
                  <Text style={styles.heroEyebrow}>AI BOOK VAULT</Text>
                  <Text style={styles.title}>My smart library</Text>
                  <Text style={styles.subtitle}>{totalBooks} books in your visual bookshelf</Text>
                </View>
                <Pressable style={styles.folderButton} onPress={() => setIsFolderModalOpen(true)}>
                  <Feather name="folder-plus" size={16} color="#0F172A" />
                  <Text style={styles.folderButtonText}>Folders</Text>
                </Pressable>
              </LinearGradient>
            </ImageBackground>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {groupedBooks.map(({ category, books: categoryBooks }) => (
              <CategorySection
                key={category}
                category={category}
                books={categoryBooks}
                onOpenPress={setSelectedBook}
                onMovePress={setMoveBook}
                onDeletePress={confirmDeleteBook}
              />
            ))}

            {!books.length ? (
              <View style={styles.emptyCard}>
                <Feather name="camera" size={30} color="#2C4A6B" />
                <Text style={styles.emptyTitle}>AI Cover Scan</Text>
                <Text style={styles.emptyText}>
                  Tap Scan Book, capture the cover, and the app will detect metadata and folder automatically.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable style={styles.fab} onPress={scanAndAutoAddBook} disabled={isProcessing}>
            {isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Feather name="camera" size={20} color="#FFFFFF" />}
            <Text style={styles.fabText}>{isProcessing ? 'Analyzing cover...' : 'Scan Book'}</Text>
          </Pressable>
        </View>

        <Modal visible={isFolderModalOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Folders</Text>

              <View style={styles.addFolderRow}>
                <TextInput
                  style={styles.input}
                  placeholder="New folder name"
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                />
                <Pressable style={styles.addFolderButton} onPress={addFolder}>
                  <Text style={styles.addFolderButtonText}>Add</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.modalList}>
                {folders.map((folder) => (
                  <View key={folder} style={styles.folderRow}>
                    <Text style={styles.folderName}>{folder}</Text>
                    <Pressable
                      style={styles.deleteFolderButton}
                      onPress={() => deleteFolder(folder)}
                    >
                      <Feather name="trash-2" size={14} color="#B91C1C" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              <Pressable style={styles.closeModalButton} onPress={() => setIsFolderModalOpen(false)}>
                <Text style={styles.closeModalButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={!!moveBook} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.moveModalCard}>
              <Text style={styles.modalTitle}>Move Book</Text>
              <Text style={styles.moveSubtitle}>{moveBook?.title}</Text>

              <ScrollView style={styles.modalList}>
                {folders.map((folder) => (
                  <Pressable
                    key={folder}
                    style={styles.moveOption}
                    onPress={() => moveBookToFolder(folder)}
                  >
                    <Feather name="folder" size={15} color="#1E3A8A" />
                    <Text style={styles.moveOptionText}>{folder}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable style={styles.closeModalButton} onPress={() => setMoveBook(null)}>
                <Text style={styles.closeModalButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={!!selectedBook} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.detailModalCard}>
              <Text style={styles.modalTitle}>Book Details</Text>
              <Text style={styles.detailTitle}>{selectedBook?.title}</Text>
              <Text style={styles.detailAuthor}>by {selectedBook?.author}</Text>

              <View style={styles.detailMetricRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Amazon India Price</Text>
                  <Text style={styles.metricValue}>{selectedBook?.price || 'N/A'}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Amazon Rating</Text>
                  <Text style={styles.metricValue}>{selectedBook?.rating || 'N/A'}</Text>
                </View>
              </View>

              <Text style={styles.detailDescription}>
                {selectedBook?.description || 'No description available.'}
              </Text>

              <View style={styles.detailActionRow}>
                <Pressable
                  style={styles.amazonButton}
                  onPress={() => {
                    if (!selectedBook?.amazonUrl) {
                      Alert.alert('Amazon data unavailable', 'Could not find Amazon India product URL for this book.');
                      return;
                    }

                    Linking.openURL(selectedBook.amazonUrl).catch(() => {
                      Alert.alert('Open failed', 'Could not open Amazon URL.');
                    });
                  }}
                >
                  <Feather name="external-link" size={14} color="#FFFFFF" />
                  <Text style={styles.amazonButtonText}>Open on Amazon.in</Text>
                </Pressable>
              </View>

              <Pressable style={styles.closeModalButton} onPress={() => setSelectedBook(null)}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 12,
    zIndex: 2
  },
  appFrame: {
    flex: 1,
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: 'rgba(255,255,255,0.36)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    overflow: 'hidden'
  },
  booksBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0
  },
  booksBackgroundImage: {
    opacity: 0.15
  },
  booksPatch: {
    position: 'absolute',
    right: -34,
    top: 38,
    width: 150,
    height: 150,
    borderRadius: 80,
    opacity: 0.24,
    zIndex: 1
  },
  header: {
    paddingTop: 8,
    paddingBottom: 14
  },
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 144,
    shadowColor: '#0F172A',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7
  },
  heroCardImage: {
    opacity: 0.95
  },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between'
  },
  heroEyebrow: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    color: '#FFFFFF',
    fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }),
    letterSpacing: 0.4,
    textTransform: 'capitalize'
  },
  subtitle: {
    marginTop: 5,
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '600'
  },
  folderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  folderButtonText: {
    marginLeft: 6,
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13
  },
  content: {
    paddingBottom: 96
  },
  emptyCard: {
    marginTop: 30,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)'
  },
  emptyTitle: {
    marginTop: 10,
    color: '#1B365D',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center'
  },
  emptyText: {
    marginTop: 8,
    color: '#405877',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19
  },
  fab: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 14,
    backgroundColor: '#1D4ED8',
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10233E',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7
  },
  fabText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    maxHeight: '85%',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24
  },
  moveModalCard: {
    maxHeight: '75%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    margin: 18,
    padding: 16
  },
  detailModalCard: {
    maxHeight: '80%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    margin: 18,
    padding: 16
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10
  },
  addFolderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    height: 42
  },
  addFolderButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addFolderButtonText: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  modalList: {
    maxHeight: 320
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  folderName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600'
  },
  deleteFolderButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2'
  },
  closeModalButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    alignItems: 'center'
  },
  closeModalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  moveSubtitle: {
    color: '#334155',
    marginBottom: 10
  },
  moveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  moveOptionText: {
    marginLeft: 8,
    color: '#0F172A',
    fontWeight: '600'
  },
  detailTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800'
  },
  detailAuthor: {
    color: '#475569',
    marginTop: 4,
    marginBottom: 12
  },
  detailMetricRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  metricLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700'
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4
  },
  detailDescription: {
    color: '#334155',
    lineHeight: 20,
    marginBottom: 14
  },
  detailActionRow: {
    marginBottom: 10
  },
  amazonButton: {
    borderRadius: 10,
    backgroundColor: '#1D4ED8',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  amazonButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 6
  }
});
