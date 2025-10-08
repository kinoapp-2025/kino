// followers.service.js
// Helpers para mantener colección espejo de followers al seguir/dejar de seguir.
import { db } from "./firebase";
import { doc, writeBatch } from "firebase/firestore";

// Crea ambos lados: following y followers
export async function followUser(myUid, targetUid) {
  if (!myUid || !targetUid || myUid === targetUid) return;
  const batch = writeBatch(db);
  // lado A: yo sigo a target
  const aRef = doc(db, "follows", myUid, "following", targetUid);
  batch.set(aRef, { since: Date.now() }, { merge: true });
  // lado B: target gana un follower (yo)
  const bRef = doc(db, "followers", targetUid, "by", myUid);
  batch.set(bRef, { since: Date.now() }, { merge: true });
  await batch.commit();
}

// Elimina ambos lados
export async function unfollowUser(myUid, targetUid) {
  if (!myUid || !targetUid || myUid === targetUid) return;
  const batch = writeBatch(db);
  const aRef = doc(db, "follows", myUid, "following", targetUid);
  batch.delete(aRef);
  const bRef = doc(db, "followers", targetUid, "by", myUid);
  batch.delete(bRef);
  await batch.commit();
}
