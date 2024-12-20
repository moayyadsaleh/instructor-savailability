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
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    dayHeaderFormat: { weekday: "long" },
    events: [],

    eventClick: async (info) => {
      if (confirm(`Delete availability for ${info.event.title}?`)) {
        await deleteDoc(doc(db, "availability", info.event.id));
      }
    },

    eventMouseEnter: (info) => {
      const { title, extendedProps } = info.event;
      const { startInput, endInput } = extendedProps;

      hoverDetailsEl.innerHTML = `
          <div style="padding: 10px; background-color: #f8f9fa; border: 1px solid #ccc; border-radius: 8px; max-width: 250px;">
            <strong style="font-size: 1.1em; display: block; margin-bottom: 5px;">${title}</strong>
            <div style="margin-bottom: 5px;">
              <strong>Available From:</strong><br>
              ${formatInputDateTime(startInput)}
            </div>
            <div>
              <strong>To:</strong><br>
              ${formatInputDateTime(endInput)}
            </div>
          </div>
        `;

      hoverDetailsEl.style.display = "block";

      // Get the cursor position relative to the viewport
      let top = info.jsEvent.clientY + 15; // Slightly below the cursor
      let left = info.jsEvent.clientX + 15; // Slightly to the right of the cursor

      // Ensure the tooltip does not go outside the viewport boundaries
      const tooltipHeight = hoverDetailsEl.offsetHeight;
      const tooltipWidth = hoverDetailsEl.offsetWidth;

      if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight - 10;
      }
      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 10;
      }

      // Apply the calculated position
      hoverDetailsEl.style.position = "fixed"; // Use fixed positioning for accurate placement
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
  onSnapshot(collection(db, "availability"), (snapshot) => {
    calendar.removeAllEvents();
    snapshot.forEach((doc) => {
      const data = doc.data();
      calendar.addEvent({
        id: doc.id,
        title: data.instructor,
        start: data.start,
        end: data.end,
        extendedProps: {
          startInput: data.startInput,
          endInput: data.endInput,
        },
      });
    });
  });

  document
    .getElementById("add-availability-btn")
    .addEventListener("click", async () => {
      const instructorName = document.getElementById("instructor-name").value;
      const start = document.getElementById("availability-start").value;
      const end = document.getElementById("availability-end").value;

      // Ensure all fields are filled out and start time is before end time
      if (instructorName && start && end) {
        if (new Date(start) >= new Date(end)) {
          alert("End time must be after start time.");
          return;
        }

        try {
          await addDoc(collection(db, "availability"), {
            instructor: instructorName,
            start: start,
            end: end,
            startInput: start,
            endInput: end,
          });
          alert("Availability added successfully!");
        } catch (error) {
          console.error("Error adding availability:", error);
          alert("Failed to add availability.");
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
    if (isNaN(parsedDate)) return input; // Fallback to raw input if parsing fails

    // Format to mm/dd/yy, hh:mm AM/PM
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
});
