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

      // Convert start and end inputs to Date objects
      const startDate = new Date(startInput);
      const endDate = new Date(endInput);

      // Calculate total teaching load in hours
      const startHour = Math.max(startDate.getHours(), 8); // Class starts at 8:00 AM
      const endHour = Math.min(endDate.getHours(), 22); // Class ends at 10:00 PM

      // Calculate the daily teaching hours
      const dailyTeachingHours = Math.max(endHour - startHour, 0); // Ensure no negative values

      let totalTeachingHours = 0;
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        // Only count hours for valid teaching days and times
        if (currentDate.getHours() >= 8 && currentDate.getHours() < 22) {
          totalTeachingHours += dailyTeachingHours;
        }
        currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
      }

      // Calculate the available times the instructor can teach
      const availableBefore =
        startDate.getHours() > 8
          ? `12:00 AM - ${startDate.getHours()}:00 AM`
          : "12:00 AM - 8:00 AM";
      const availableAfter =
        endDate.getHours() < 22
          ? `${endDate.getHours()}:00 AM - 10:00 PM`
          : "10:00 AM - 10:00 PM";

      hoverDetailsEl.innerHTML = `
          <div style="
              padding: 10px; 
              background-color: #f8f9fa; 
              border: 1px solid #ccc; 
              border-radius: 8px; 
              max-width: 250px; 
              font-family: Arial, sans-serif;
          ">
              <strong style="
                  font-size: 1.2em; 
                  display: block; 
                  margin-bottom: 5px; 
                  color: #333;
              ">
                  ${title} is teaching
              </strong>
              <div style="
                  margin-bottom: 5px; 
                  font-size: 0.9em; 
                  color: #555;
              ">
                  <strong>Class:</strong> ${className}
              </div>
              <div style="
                  margin-bottom: 5px; 
                  font-size: 0.9em; 
                  color: #555;
              ">
                  <strong>Class Total Hours:</strong> ${
                    totalTeachingHours || "N/A"
                  } hours
              </div>
              <div style="
                  margin-bottom: 5px; 
                  font-size: 0.9em; 
                  color: #555;
              ">
                  <strong>Class Time:</strong> From ${formatInputDateTime(
                    startInput
                  )} to ${formatInputDateTime(endInput)}
              </div>
              <div style="
                  margin-bottom: 5px; 
                  font-size: 0.9em; 
                  color: #555;
              ">
                  <strong>Available Teaching Times:</strong>
                  <div>Free to Teach: ${availableBefore}</div>
                  <div>Free to Teach: ${availableAfter}</div>
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
document.getElementById("export-excel-btn").addEventListener("click", () => {
  const events = calendar.getEvents();

  if (events.length === 0) {
    alert("No events to export!");
    return;
  }

  // Prepare data for Excel
  const data = [
    ["Instructor", "Class", "Start Date & Time", "End Date & Time"], // Header row
  ];

  events.forEach((event) => {
    const { title, extendedProps, start, end } = event;
    data.push([
      title,
      extendedProps.className || "N/A",
      formatInputDateTime(start),
      formatInputDateTime(end),
    ]);
  });

  // Convert data to worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Style the header row (optional)
  const headerRange = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4CAF50" } }, // Green background for header
    };
  }

  // Create a workbook and export it
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Teaching Schedule");

  // Export as Excel file
  XLSX.writeFile(workbook, "teaching_schedule.xlsx");
});
