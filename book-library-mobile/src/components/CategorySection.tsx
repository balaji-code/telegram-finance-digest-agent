import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BookCard from './BookCard';
import { Book } from '../types/book';

type Props = {
  category: string;
  books: Book[];
  onOpenPress: (book: Book) => void;
  onMovePress: (book: Book) => void;
  onDeletePress: (book: Book) => void;
};

function colorForCategory(category: string): string {
  const palette = ['#1A936F', '#2563EB', '#7C3AED', '#B45309', '#A21CAF', '#0F766E', '#DB2777', '#475569'];
  const hash = category
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return palette[hash % palette.length];
}

export default function CategorySection({
  category,
  books,
  onOpenPress,
  onMovePress,
  onDeletePress
}: Props) {
  if (!books.length) return null;

  const folderColor = colorForCategory(category);

  return (
    <View style={styles.section}>
      <View style={styles.folder3dWrap}>
        <View style={[styles.folderBack, { backgroundColor: folderColor }]} />
        <View style={[styles.folderTopLip, { backgroundColor: folderColor }]} />
        <View style={[styles.folderFront, { backgroundColor: folderColor }]}>
          <View style={styles.headerRow}>
            <View style={styles.folderIconWrap}>
              <Feather name="folder" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>{category}</Text>
            <Text style={styles.count}>{books.length}</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onOpenPress={onOpenPress}
            onMovePress={onMovePress}
            onDeletePress={onDeletePress}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 14
  },
  folder3dWrap: {
    marginBottom: 8
  },
  folderBack: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 6,
    height: 38,
    borderRadius: 10,
    opacity: 0.32
  },
  folderTopLip: {
    width: 95,
    height: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    opacity: 0.8,
    marginLeft: 10
  },
  folderFront: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  folderIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  title: {
    marginLeft: 7,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    flex: 1
  },
  count: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600'
  },
  row: {
    paddingRight: 8
  }
});
