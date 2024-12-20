import {
  db,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  const hoverDetailsEl = document.createElement("div");
  hoverDetailsEl.id = "hover-details";
  hoverDetailsEl.className = "hover-popup";
  document.body.appendChild(hoverDetailsEl); // Append tooltip to body

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    timeZone: "America/New_York",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,dayGridYear",
    },
    views: {
      dayGridYear: {
        type: "dayGrid",
        duration: { years: 1 },
        buttonText: "Year",
      },
    },
    dayHeaderFormat: { weekday: "long" },
    events: [],

    eventClick: async (info) => {
      if (confirm(`Delete class for ${info.event.title}?`)) {
        await deleteDoc(doc(db, "teaching-schedule", info.event.id));
      }
    },

    eventMouseEnter: (info) => {
      const { title, extendedProps } = info.event;
      const { startInput, endInput, className } = extendedProps;

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
    snapshot.forEach((doc) => {
      const data = doc.data();

      calendar.addEvent({
        id: doc.id,
        title: data.instructor,
        start: data.start,
        end: data.end,
        color: instructorColors[data.instructor] || getRandomColor(),
        extendedProps: {
          className: data.className, // Include class name in extended properties
          startInput: data.start,
          endInput: data.end,
        },
      });
    });
  });

  // Adding teaching hours (classes)
  document
    .getElementById("add-class-btn")
    .addEventListener("click", async () => {
      const instructorName = document.getElementById("instructor-name").value;
      const className = document.getElementById("class-name").value;
      const start = document.getElementById("class-start").value;
      const end = document.getElementById("class-end").value;

      if (instructorName && className && start && end) {
        if (new Date(start) >= new Date(end)) {
          alert("End time must be after start time.");
          return;
        }

        try {
          await addDoc(collection(db, "teaching-schedule"), {
            instructor: instructorName,
            className: className,
            start: start,
            end: end,
            startInput: start,
            endInput: end,
          });
          alert("Class added successfully!");
        } catch (error) {
          console.error("Error adding class:", error);
          alert("Failed to add class.");
        }
      } else {
        alert("Please fill out all fields.");
      }
    });

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

  function formatInputDateTime(input) {
    const parsedDate = new Date(input);
    if (isNaN(parsedDate)) return input;

    const datePart = parsedDate.toLocaleDateString("en-US", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
    const timePart = parsedDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${datePart}, ${timePart}`;
  }

  const instructorColors = {};

  function getRandomColor() {
    return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
  }
});
