import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const availabilityForm = document.getElementById("availability-form");
const availabilityList = document.getElementById("availability-list");

// Function to render availability data
function renderAvailability(doc) {
  const li = document.createElement("li");
  li.textContent = `${doc.data().name} - ${doc.data().date} at ${
    doc.data().time
  }`;
  availabilityList.appendChild(li);
}

// Real-time listener to display availability
onSnapshot(collection(db, "availability"), (snapshot) => {
  availabilityList.innerHTML = "";
  snapshot.docs.forEach(renderAvailability);
});

// Handle form submission
availabilityForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  try {
    await addDoc(collection(db, "availability"), {
      name,
      date,
      time,
    });

    availabilityForm.reset();
  } catch (error) {
    console.error("Error adding document: ", error);
  }
});
