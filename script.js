import {
  db,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "./firebase-config.js";

let allSchedules = []; // Will hold all events from Firestore
let calendar;

document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  const hoverDetailsEl = document.createElement("div");
  hoverDetailsEl.id = "hover-details";
  hoverDetailsEl.className = "hover-popup";
  document.body.appendChild(hoverDetailsEl); // Append tooltip to body

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    timeZone: "America/New_York",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,dayGridYear", // Only month & year views
    },
    views: {
      dayGridYear: {
        type: "dayGrid",
        duration: { years: 1 },
        buttonText: "Year",
      },
    },
    dayHeaderFormat: { weekday: "long" },

    // Force 24-hour time display for events
    eventTimeFormat: {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // 24-hour format
    },

    events: [],

    eventClick: async (info) => {
      if (confirm(`Delete class for ${info.event.title}?`)) {
        await deleteDoc(doc(db, "teaching-schedule", info.event.id));
      }
    },

    eventMouseEnter: (info) => {
      const { title, extendedProps } = info.event;
      const { startInput, endInput, className, recurringDays } = extendedProps;

      // We'll build a "repeats on" line if there's recurringDays
      let recurringText = "";
      if (recurringDays && recurringDays.length > 0) {
        // Convert numeric days to string (0=Sun, 1=Mon, etc.)
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const selectedDayNames = recurringDays.map((d) => dayNames[d]);
        recurringText = `
          <div style="margin-top: 5px;">
            <strong>Repeats on:</strong><br>
            ${selectedDayNames.join(", ")}
          </div>`;
      }

      hoverDetailsEl.innerHTML = `
        <div style="padding: 10px; background-color: #f8f9fa; border: 1px solid #ccc; border-radius: 8px; max-width: 250px;">
          <strong style="font-size: 1.1em; display: block; margin-bottom: 5px;">${title}</strong>
          <div style="margin-bottom: 5px;">
            <strong>Class:</strong><br>
            ${className}
          </div>
          <div>
            <strong>From:</strong><br>
            ${formatInputDateTime(startInput)}
          </div>
          <div>
            <strong>To:</strong><br>
            ${formatInputDateTime(endInput)}
          </div>
          ${recurringText}
        </div>
      `;

      hoverDetailsEl.style.display = "block";

      let top = info.jsEvent.clientY + 15;
      let left = info.jsEvent.clientX + 15;
      const tooltipHeight = hoverDetailsEl.offsetHeight;
      const tooltipWidth = hoverDetailsEl.offsetWidth;

      if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight - 10;
      }
      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 10;
      }

      hoverDetailsEl.style.position = "fixed";
      hoverDetailsEl.style.top = `${top}px`;
      hoverDetailsEl.style.left = `${left}px`;
    },

    eventMouseLeave: () => {
      hoverDetailsEl.style.display = "none";
    },

    datesSet: () => addFullDatesToHeaders(),
  });

  calendar.render();

  // Listen for database changes and update events
  onSnapshot(collection(db, "teaching-schedule"), (snapshot) => {
    calendar.removeAllEvents();
    allSchedules = []; // Reset our local array

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const eventObj = {
        id: docSnap.id,
        title: data.instructor,
        start: data.start,
        end: data.end,
        color: instructorColors[data.instructor] || getRandomColor(),
        extendedProps: {
          className: data.className,
          startInput: data.start,
          endInput: data.end,
          recurringDays: data.recurringDays || [],
        },
        allDay: false, // Keep this for accurate scheduling
      };
      calendar.addEvent(eventObj);

      // Store for availability lookups
      allSchedules.push({
        id: docSnap.id,
        instructor: data.instructor,
        start: data.start,
        end: data.end,
      });
    });
  });

  // Add a single class entry (with optional recurring days)
  document
    .getElementById("add-class-btn")
    .addEventListener("click", async () => {
      const instructorName = document.getElementById("instructor-name").value;
      const className = document.getElementById("class-name").value;
      const startVal = document.getElementById("class-start").value;
      const endVal = document.getElementById("class-end").value;

      const recDayCheckboxes = document.querySelectorAll(".rec-days:checked");
      const daysOfWeek = Array.from(recDayCheckboxes).map((cb) =>
        parseInt(cb.value)
      );

      // Basic validation
      if (!instructorName || !className || !startVal || !endVal) {
        alert("Please fill out all fields.");
        return;
      }
      if (new Date(startVal) >= new Date(endVal)) {
        alert("End time must be after start time.");
        return;
      }

      try {
        await addDoc(collection(db, "teaching-schedule"), {
          instructor: instructorName,
          className: className,
          start: startVal,
          end: endVal,
          startInput: startVal,
          endInput: endVal,
          recurringDays: daysOfWeek,
        });
        alert("Event added successfully!");
      } catch (error) {
        console.error("Error adding class:", error);
        alert("Failed to add class.");
      }
    });

  // NEW: Search available teachers
  document
    .getElementById("search-available-btn")
    .addEventListener("click", searchAvailableTeachers);

  function searchAvailableTeachers() {
    const startVal = document.getElementById("search-start").value;
    const endVal = document.getElementById("search-end").value;
    const resultEl = document.getElementById("available-teachers");

    // Validate
    if (!startVal || !endVal) {
      alert("Please provide both start and end times.");
      return;
    }
    const searchStart = new Date(startVal);
    const searchEnd = new Date(endVal);
    if (searchStart >= searchEnd) {
      alert("End time must be after start time.");
      return;
    }

    // Build a set of all instructors present in the schedule
    const allInstructors = new Set(allSchedules.map((ev) => ev.instructor));

    // Now we figure out who is busy during searchStart...searchEnd
    // Overlap condition: (searchStart < existingEnd) and (searchEnd > existingStart)
    const busyInstructors = new Set();
    allSchedules.forEach((ev) => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);

      const isOverlap = searchStart < evEnd && searchEnd > evStart;
      if (isOverlap) {
        busyInstructors.add(ev.instructor);
      }
    });

    // The available instructors are those not in 'busyInstructors'
    const availableInstructors = [...allInstructors].filter(
      (instr) => !busyInstructors.has(instr)
    );

    // Show results
    if (availableInstructors.length === 0) {
      resultEl.textContent = "No available instructors for that time range.";
    } else {
      resultEl.textContent = `Available Instructors: ${availableInstructors.join(
        ", "
      )}`;
    }
  }

  // Utility functions
  function addFullDatesToHeaders() {
    const dayHeaderCells = document.querySelectorAll(".fc-col-header-cell");
    dayHeaderCells.forEach((cell) => {
      const dateStr = cell.getAttribute("data-date");
      if (dateStr) {
        const fullDate = new Date(dateStr).toLocaleDateString("en-US", {
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
        });
        if (!cell.querySelector(".full-date")) {
          const dateElement = document.createElement("div");
          dateElement.className = "full-date";
          dateElement.textContent = fullDate;
          cell.appendChild(dateElement);
        }
      }
    });
  }

  // UPDATED for 24-hour format (hour12: false)
  function formatInputDateTime(input) {
    const parsedDate = new Date(input);
    if (isNaN(parsedDate)) return input;

    const datePart = parsedDate.toLocaleDateString("en-US", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
    // 24-hour time
    const timePart = parsedDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return `${datePart}, ${timePart}`;
  }

  const instructorColors = {};

  function getRandomColor() {
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
  }
});
