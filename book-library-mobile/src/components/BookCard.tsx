import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Book } from '../types/book';

type Props = {
  book: Book;
  onOpenPress: (book: Book) => void;
  onMovePress: (book: Book) => void;
  onDeletePress: (book: Book) => void;
};

export default function BookCard({ book, onOpenPress, onMovePress, onDeletePress }: Props) {
  return (
    <Pressable style={styles.card} onPress={() => onOpenPress(book)}>
      <Image source={{ uri: book.coverUri }} style={styles.cover} />
      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.title}>{book.title}</Text>
        <Text numberOfLines={1} style={styles.author}>{book.author || 'Unknown author'}</Text>
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.moveButton}
            onPress={(event) => {
              event.stopPropagation();
              onMovePress(book);
            }}
          >
            <Feather name="folder" size={12} color="#1E3A8A" />
            <Text style={styles.moveText}>Move</Text>
          </Pressable>
          <Pressable
            style={styles.deleteButton}
            onPress={(event) => {
              event.stopPropagation();
              onDeletePress(book);
            }}
          >
            <Feather name="trash-2" size={12} color="#991B1B" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 124,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden'
  },
  cover: {
    width: '100%',
    height: 145,
    backgroundColor: '#D9D9D9'
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  title: {
    color: '#1D2433',
    fontWeight: '700',
    fontSize: 13
  },
  author: {
    marginTop: 3,
    color: '#5A6371',
    fontSize: 11
  },
  actionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  moveButton: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center'
  },
  moveText: {
    marginLeft: 4,
    color: '#1E3A8A',
    fontSize: 10,
    fontWeight: '700'
  },
  deleteButton: {
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
