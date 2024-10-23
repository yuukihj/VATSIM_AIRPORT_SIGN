const INCHEON_AIRPORT_COORDS = {
  latitude: 37.4625,
  longitude: 126.439167,
};

const headersKorean = ["도착시간", "편명", "출발지", "변경시간", "현황"];
const headersEnglish = ["TIME", "FLT NO", "FROM", "NEW", "STATUS"];

// 모든 테이블의 헤더 가져오기
const tables = document.querySelectorAll("table");

// 헤더를 변경하는 함수
let isKorean = true; // 현재 언어 상태
function toggleHeaders() {
  tables.forEach((table) => {
    const headers = table.querySelectorAll("th");
    headers.forEach((th, index) => {
      th.textContent = isKorean ? headersEnglish[index] : headersKorean[index];
    });
  });
  isKorean = !isKorean; // 언어 상태 반전
}

let airports = {};

async function fetchAirportData() {
  try {
    const response = await fetch("./airport.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const airportsArray = await response.json();

    airports = {};
    airportsArray.forEach((airport) => {
      airports[airport.icao] = {
        koreanName: airport.koreanName,
        englishName: airport.englishName,
      };
    });
  } catch (error) {
    console.error("공항 데이터를 가져오는 중 오류 발생:", error);
  }
}

fetchAirportData();
fetchArrivalData();
setInterval(toggleHeaders, 3000);

function calculateArrivalTime(deptime, enrouteTime) {
  const depHour = deptime.substring(0, 2);
  const depMinute = deptime.substring(2, 4);
  const formattedDepTime = `${depHour}:${depMinute}`;

  if (
    !formattedDepTime ||
    !/^([01]\d|2[0-3]):([0-5]\d)$/.test(formattedDepTime)
  ) {
    console.error("Invalid departure time format:", formattedDepTime);
    return "N/A";
  }

  const depTime = new Date(`1970-01-01T${formattedDepTime}:00Z`);
  const enrouteHour = parseInt(enrouteTime.substring(0, 2), 10);
  const enrouteMinute = parseInt(enrouteTime.substring(2, 4), 10);
  const totalEnrouteMinutes = enrouteHour * 60 + enrouteMinute;
  const utcPlus9Time = new Date(depTime.getTime() + 9 * 60 * 60 * 1000);

  const arrivalTime = new Date(
    utcPlus9Time.getTime() + totalEnrouteMinutes * 60 * 1000
  );

  if (isNaN(arrivalTime.getTime())) {
    console.error("Invalid arrival time calculated:", arrivalTime);
    return "N/A";
  }

  const localArrivalTime = new Date(arrivalTime.getTime());
  if (localArrivalTime.getUTCHours() >= 15) {
    localArrivalTime.setUTCDate(localArrivalTime.getUTCDate() + 1);
    localArrivalTime.setUTCHours(localArrivalTime.getUTCHours() - 24);
  }

  const arrivalHH = String(localArrivalTime.getUTCHours()).padStart(2, "0");
  const arrivalMM = String(localArrivalTime.getUTCMinutes()).padStart(2, "0");
  return `${arrivalHH}:${arrivalMM}`;
}

function calculateStatus(pilot, changeTime, arrivalTime) {
  const distance = calculateDistance(
    INCHEON_AIRPORT_COORDS.latitude,
    INCHEON_AIRPORT_COORDS.longitude,
    pilot.latitude,
    pilot.longitude
  );

  if (distance < 2.5 && pilot.altitude < 300 && pilot.groundspeed > 0) {
    return "착륙";
  } else if (
    distance < 2.5 &&
    pilot.altitude < 300 &&
    pilot.groundspeed === 0
  ) {
    return "도착";
  } else if (changeTime && arrivalTime) {
    const [arrivalHH, arrivalMM] = arrivalTime.split(":").map(Number);
    const [changeHH, changeMM] = changeTime.split(":").map(Number);

    const arrivalDateTime = new Date();
    arrivalDateTime.setHours(arrivalHH);
    arrivalDateTime.setMinutes(arrivalMM);

    const changeDateTime = new Date();
    changeDateTime.setHours(changeHH);
    changeDateTime.setMinutes(changeMM);

    const timeDifference = (changeDateTime - arrivalDateTime) / (1000 * 60);

    if (timeDifference > 15) {
      return "지연";
    }
  }

  return "";
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3440;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function fetchArrivalData() {
  try {
    const response = await fetch("https://data.vatsim.net/v3/vatsim-data.json");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const arrivals = data.pilots.filter(
      (pilot) => pilot.flight_plan && pilot.flight_plan.arrival === "RKSI"
    );

    const formattedData = arrivals.map((pilot) => {
      const arrivalTime = calculateArrivalTime(
        pilot.flight_plan.deptime,
        pilot.flight_plan.enroute_time
      );

      const departureIcao = pilot.flight_plan.departure;
      const groundspeed = pilot.groundspeed;
      const koreanDepartureName =
        airports[departureIcao]?.koreanName || `${departureIcao}`;
      const englishDepartureName =
        airports[departureIcao]?.englishName || `${departureIcao}`;

      const distanceToAirport = calculateDistance(
        INCHEON_AIRPORT_COORDS.latitude,
        INCHEON_AIRPORT_COORDS.longitude,
        pilot.latitude,
        pilot.longitude
      );

      let formattedChangeTime = "";
      if (groundspeed >= 40) {
        const changeTimeInSeconds = distanceToAirport / groundspeed;
        const currentTime = new Date();
        const changeTime = new Date(
          currentTime.getTime() + changeTimeInSeconds * 1000 * 3600
        );

        const changeHH = String(changeTime.getHours()).padStart(2, "0");
        const changeMM = String(changeTime.getMinutes()).padStart(2, "0");
        formattedChangeTime = `${changeHH}:${changeMM}`;
      }

      return {
        flightNo: pilot.callsign,
        departure: {
          korean: koreanDepartureName,
          english: englishDepartureName,
        },
        arrival: pilot.flight_plan.arrival,
        status: calculateStatus(pilot, formattedChangeTime, arrivalTime),
        arrivalTime: arrivalTime,
        changeTime: formattedChangeTime,
      };
    });

    formattedData.sort((a, b) => {
      const [aHH, aMM] = a.arrivalTime.split(":").map(Number);
      const [bHH, bMM] = b.arrivalTime.split(":").map(Number);

      const currentTime = new Date();
      const currentHour = currentTime.getUTCHours();
      const currentMinute = currentTime.getUTCMinutes();

      const aTotalMinutes =
        (aHH +
          (aHH < currentHour || (aHH === currentHour && aMM < currentMinute)
            ? 24
            : 0)) *
          60 +
        aMM;
      const bTotalMinutes =
        (bHH +
          (bHH < currentHour || (bHH === currentHour && bMM < currentMinute)
            ? 24
            : 0)) *
          60 +
        bMM;

      return aTotalMinutes - bTotalMinutes;
    });

    displayData(formattedData);
  } catch (error) {
    console.error("데이터를 가져오는 중 오류 발생:", error);
  }
}

function displayData(data) {
  const tbody1 = document.querySelector("#arrival-board-1 tbody");
  const tbody2 = document.querySelector("#arrival-board-2 tbody");

  const rows = tbody1.querySelectorAll("tr");
  data.forEach((item, index) => {
    const [hour, minute] = item.arrivalTime.split(":");
    const row = rows[index] || document.createElement("tr");

    if (!rows[index]) {
      row.innerHTML = `
          <td><span>${hour}</span><span class="blink">:</span><span>${minute}</span></td>
          <td>${item.flightNo}</td>
          <td class="toggle-name">${item.departure.korean}</td> <!-- 한국어 이름 -->
          <td class="toggle-name hidden">${item.departure.english}</td> <!-- 영어 이름 -->
          <td>${item.changeTime}</td> <!-- 변경시간 -->
          <td class="toggle-status">${item.status}</td> <!-- 상태 -->
      `;
      if (index < 12) {
        tbody1.appendChild(row);
      } else {
        tbody2.appendChild(row);
      }
    } else {
      row.innerHTML = `
          <td><span>${hour}</span><span class="blink">:</span><span>${minute}</span></td>
          <td>${item.flightNo}</td>
          <td class="toggle-name">${item.departure.korean}</td> <!-- 한국어 이름 -->
          <td class="toggle-name hidden">${item.departure.english}</td> <!-- 영어 이름 -->
          <td>${item.changeTime}</td> <!-- 변경시간 -->
          <td class="toggle-status">${item.status}</td> <!-- 상태 -->
      `;
    }
    toggleDepartureName(row);
    toggleStatus(row);
  });
}

function toggleDepartureName(row) {
  const koreanName = row.querySelector("td:nth-child(3)");
  const englishName = row.querySelector("td:nth-child(4)");
  let isKorean = true;

  setInterval(() => {
    if (isKorean) {
      koreanName.classList.add("hidden");
      englishName.classList.remove("hidden");
    } else {
      koreanName.classList.remove("hidden");
      englishName.classList.add("hidden");
    }
    isKorean = !isKorean;
  }, 3000);
}

function toggleStatus(row) {
  const statusCell = row.querySelector(".toggle-status");
  let isKorean = true;

  setInterval(() => {
    if (isKorean) {
      switch (statusCell.textContent) {
        case "지연":
          statusCell.textContent = "DELAYED";
          statusCell.classList.add("red-background");
          break;
        case "도착":
          statusCell.textContent = "ARRIVED";
          statusCell.classList.remove("red-background");
          break;
        case "착륙":
          statusCell.textContent = "LANDED";
          statusCell.classList.remove("red-background");
          break;
        default:
          break;
      }
    } else {
      switch (statusCell.textContent) {
        case "DELAYED":
          statusCell.textContent = "지연";
          statusCell.classList.add("red-background");
          break;
        case "ARRIVED":
          statusCell.textContent = "도착";
          statusCell.classList.remove("red-background");
          break;
        case "LANDED":
          statusCell.textContent = "착륙";
          statusCell.classList.remove("red-background");
          break;
        default:
          break;
      }
    }
    isKorean = !isKorean;
  }, 3000);
}

function initializeTable() {
  const tbody1 = document.querySelector("#arrival-board-1 tbody");
  const tbody2 = document.querySelector("#arrival-board-2 tbody");

  for (let i = 0; i < 12; i++) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td></td>
        <td></td>
        <td></td>
        <td class="hidden"></td>
        <td></td>
        <td></td>
    `;
    tbody1.appendChild(row);
  }

  for (let i = 0; i < 12; i++) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td></td>
        <td></td>
        <td></td>
        <td class="hidden"></td>
        <td></td>
        <td></td>
    `;
    tbody2.appendChild(row);
  }
}

initializeTable();