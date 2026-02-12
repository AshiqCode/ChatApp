import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC3KcQSG8THJnpzyr_vlOsFx_yNrMwacS8",
  authDomain: "network-cecda.firebaseapp.com",
  projectId: "network-cecda",
  storageBucket: "network-cecda.appspot.com",
  messagingSenderId: "90708300742",
  appId: "1:90708300742:web:c383d50386d48d3a9dd8c7",
  databaseURL: "https://network-cecda-default-rtdb.firebaseio.com/",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
