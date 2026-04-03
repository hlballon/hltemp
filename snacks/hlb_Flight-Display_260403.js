import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, View, StyleSheet, Dimensions, Button, ScrollView, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Svg, { Circle, Line, Text as SvgText, Rect } from 'react-native-svg';
import mqtt from 'mqtt';

const LOG_FILE_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/temp.jsonl';
const WEATHER_FILE_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/temp_w.txt';
const LIVE_ICON_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/latest_icon_sounding.geojson';
const GEOJSON_FILE_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/manual-fetched.geojson';
// const GEOJSON_FILE_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/52p50_13p40_20260327_180000.geojson.br';
const WYOMING_URL = 'https://raw.githubusercontent.com/hlballon/hltemp/refs/heads/main/wyoming.txt';
const MAX_POINTS_ACC = 60;
const MAX_POINTS_ALT = 10000;
const time_factor = 10;
const ALT_MIN = 0;
const ALT_MAX =6000;
const OMIT_POINTS = 10;

// MQTT configuration
const MQTT_BROKER = 'wss://w471.gimmbh.com:8084/mqtt';
const MQTT_TOPIC = 'balloon/readings';
const MQTT_TOPIC_REQUEST = 'balloon/request_sounding';
const MQTT_USER = 'lorMQTT';
const MQTT_PASS = 'l0rHBQND';
const MQTT_CLIENT_ID = `balloon_${Date.now()}`;

// Legend Component
const Legend = ({ showCSounding, showIconD2, showIconH, showGeoJson, showWyoming }) => {
  return (
    <View style={styles.legendContainer}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: 'rgba(255, 99, 132, 1)' }]} />
        <Text style={styles.legendText}>Balloon Data</Text>
      </View>
      {showCSounding && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'green' }]} />
          <Text style={styles.legendText}>cSounding</Text>
        </View>
      )}
      {showIconD2 && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'blue' }]} />
          <Text style={styles.legendText}>Selected Model</Text>
        </View>
      )}
	  {showIconH && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00CED1' }]} />
          <Text style={styles.legendText}>ICON h-Levels</Text>
      </View>
      )}
      {showGeoJson && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'purple' }]} />
          <Text style={styles.legendText}>GeoJSON Sounding</Text>
        </View>
      )}
      {showWyoming && (
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFFF00' }]} />
          <Text style={styles.legendText}>Wyoming Sounding</Text>
        </View>
      )}
    </View>
  );
};

// ScatterPlot component
  const ScatterPlot = ({
    data,
    width,
    height,
    xTitle,
    yTitle,
    xField,
    yField,
    yMin,
    yMax,
    cSoundingData,
    iconD2Data,
    iconHData,
    showCSounding,
    showIconD2,
    showIconH,
    geoJsonData,
    showGeoJson,
    wyomingData,
    showWyoming,
    userAltMin,
    userAltMax
  }) => {
  const padding = 20;
  const leftPadding = 30;
  const max_acc = 0.05;

  console.log(`ScatterPlot ${yTitle}: data length=${data.length}, showCSounding=${showCSounding}, cSoundingData length=${cSoundingData ? cSoundingData.length : 0}, showIconD2=${showIconD2}, iconD2Data length=${iconD2Data ? iconD2Data.length : 0}, showGeoJson=${showGeoJson}, geoJsonData length=${geoJsonData ? geoJsonData.length : 0}, showWyoming=${showWyoming}, wyomingData length=${wyomingData ? wyomingData.length : 0}`);

  if (
  data.length === 0 &&
  (!showCSounding || !cSoundingData || cSoundingData.length === 0) &&
  (!showIconD2 || !iconD2Data || iconD2Data.length === 0) &&
  (!showIconH || !iconHData || iconHData.length === 0) &&
  (!showGeoJson || !geoJsonData || geoJsonData.length === 0) &&
  (!showWyoming || !wyomingData || wyomingData.length === 0)
   ) {
  return <Text>No data available for {yTitle}</Text>;
  }


  const filteredData = yField === 'altitude' ? data.filter((_, index) => index % OMIT_POINTS === 0) : data;

  const xValues = data.map(point => point[xField]);
  const cSoundingXValues = showCSounding && cSoundingData ? cSoundingData.map(point => point[xField]) : [];
  const iconD2XValues = showIconD2 && iconD2Data ? iconD2Data.map(point => point[xField]) : [];
  const geoJsonXValues = showGeoJson && geoJsonData ? geoJsonData.map(point => point[xField] || 0) : [];
  const wyomingXValues = showWyoming && wyomingData ? wyomingData.map(point => point[xField]) : [];
  const iconHXValues = showIconH && iconHData ? iconHData.map(point => point[xField]) : [];
  const allXValues = [...xValues, ...cSoundingXValues, ...iconD2XValues, ...iconHXValues, ...geoJsonXValues, ...wyomingXValues];
  const xMin = allXValues.length > 0 ? Math.min(...allXValues.filter(v => v != null)) : 0;
  const xMax = allXValues.length > 0 ? Math.max(...allXValues.filter(v => v != null)) : 1;
  const xRange = xMax - xMin;

  let yTickFormat;
  if (yTitle === "Accel (m/s²)") {
    yMin = yMin ?? -max_acc;
    yMax = yMax ?? max_acc;
    yTickFormat = (tick) => tick.toFixed(3);
  } else {
    yMin = yMin ?? userAltMin;
    yMax = yMax ?? userAltMax;
    yTickFormat = (tick) => tick.toFixed(0);
  }
  const yRange = yMax - yMin;

  const xScale = (x) => (xRange === 0 ? (width - leftPadding - padding) / 2 + leftPadding : leftPadding + ((x - xMin) / xRange) * (width - leftPadding - padding));
  const yScale = (y) => (yRange === 0 ? height / 2 : height - padding - ((y - yMin) / yRange) * (height - 2 * padding));

  const xAxisY = yScale(yTitle === "Accel (m/s²)" ? 0 : yMin);
  const yAxisX = xScale(xMin);

  const xTicks = xRange === 0 ? [xMin] : Array.from({ length: 3 }, (_, i) => xMin + (i * xRange) / 2);
  const yTicks = yRange === 0 ? [yMin] : Array.from({ length: 5 }, (_, i) => yMin + (i * yRange) / 4);

  const yAxisTitlePosition = 180;
  const overlapThreshold = 10;

  // Define three help lines at 25%, 50%, and 75% of the y-range
  const helpLineFractions = [0.25, 0.5, 0.75];
  const helpLines = helpLineFractions.map(fraction => ({
    yValue: yMin + fraction * yRange,
    yPosition: yScale(yMin + fraction * yRange),
  }));

  return (
    <View style={styles.chartWrapper}>
      {(showCSounding || showIconD2 || showGeoJson || showWyoming || yTitle !== "Accel (m/s²)") && (
		<Legend
           showCSounding={showCSounding}
           showIconD2={showIconD2}
           showIconH={showIconH}
           showGeoJson={showGeoJson}
           showWyoming={showWyoming}
        />
      )}
      <Text style={styles.yAxisTitle}>{yTitle}</Text>
      <Svg width={width} height={height}>
        <Rect x={leftPadding} y={padding} width={width - leftPadding - padding} height={height - 2 * padding} fill="none" stroke="black" strokeWidth="1" />
        <Line x1={leftPadding} y1={xAxisY} x2={width - padding} y2={xAxisY} stroke="black" strokeWidth="1" />
        <Line x1={yAxisX} y1={padding} x2={yAxisX} y2={height - padding} stroke="black" strokeWidth="1" />
        {xTicks.map((tick, index) => (
          <SvgText key={`x-${tick}-${index}`} x={xScale(tick)} y={xAxisY + 15} fontSize="8" fontWeight="bold" textAnchor="middle">
            {Math.round(tick)}
          </SvgText>
        ))}
        {yTicks.map((tick, index) => {
          const tickYPosition = yScale(tick) + 3;
          if (Math.abs(tickYPosition - yAxisTitlePosition) < overlapThreshold) return null;
          return (
            <SvgText key={`y-${tick}-${index}`} x={yAxisX - 15} y={tickYPosition} fontSize="8" fontWeight="bold" textAnchor="end">
              {yTickFormat(tick)}
            </SvgText>
          );
        })}
        {/* Add three horizontal help lines */}
        {helpLines.map((line, index) => (
          <Line
            key={`help-line-${index}`}
            x1={leftPadding}
            y1={line.yPosition}
            x2={width - padding}
            y2={line.yPosition}
            stroke="#d3d3d3"
            strokeWidth="0.5"
          />
        ))}
        {filteredData.filter(point => point[xField] != null).map((point, index) => (
          <Circle key={`point-${index}`} cx={xScale(point[xField])} cy={yScale(point[yField])} r={3} fill="rgba(255, 99, 132, 1)" stroke="black" strokeWidth="1.5" />
        ))}
        {showCSounding && cSoundingData && cSoundingData.filter(point => point[xField] != null).map((point, index) => (
          <Circle key={`csounding-${index}`} cx={xScale(point[xField])} cy={yScale(point[yField])} r={3} fill="green" stroke="black" strokeWidth="1.5" />
        ))}
        {showIconD2 && iconD2Data && iconD2Data.filter(point => point[xField] != null).map((point, index) => (
          <Circle key={`icond2-${index}`} cx={xScale(point[xField])} cy={yScale(point[yField])} r={3} fill="blue" stroke="black" strokeWidth="1.5" />
        ))}
		{showIconH && iconHData && iconHData.filter(point => point[xField] != null).map((point, index) => (
          <Circle key={`iconh-${index}`}  cx={xScale(point[xField])}  cy={yScale(point[yField])}  r={3} fill="#00CED1" stroke="black" strokeWidth="1.5" />
))}
        {showGeoJson && geoJsonData && geoJsonData.filter(point => point[xField] != null).map((point, index) => (
          <Circle key={`geojson-${index}`} cx={xScale(point[xField])} cy={yScale(point[yField])} r={3} fill="purple" stroke="black" strokeWidth="1.5" />
        ))}
        {showWyoming && wyomingData && wyomingData.filter(point => point[xField] != null).map((point, index) => (
          <Circle key={`wyoming-${index}`} cx={xScale(point[xField])} cy={yScale(point[yField])} r={3} fill="#FFFF00" stroke="black" strokeWidth="1.5" />
        ))}
      </Svg>
      <Text style={styles.xAxisTitle}>{xTitle}</Text>
    </View>
  );
};

// PolarPlot component
  const PolarPlot = React.memo(({ data, cSoundingData, iconD2Data, iconHData, showCSounding, showIconD2, showIconH, geoJsonData, showGeoJson, wyomingData, showWyoming, width, height, altitudeMin, altitudeMax, userAltMin, userAltMax, fetchError, wyomingFirstLine }) => {
  const radius = Math.min(width, height) / 2 - 20;
  const centerX = width / 2;
  const centerY = height / 2;

  console.log(`PolarPlot: data length=${data.length}, showCSounding=${showCSounding}, cSoundingData length=${cSoundingData ? cSoundingData.length : 0}, showIconD2=${showIconD2}, iconD2Data length=${iconD2Data ? iconD2Data.length : 0}, showGeoJson=${showGeoJson}, geoJsonData length=${geoJsonData ? geoJsonData.length : 0}, showWyoming=${showWyoming}, wyomingData length=${wyomingData ? wyomingData.length : 0}`);

  if (
  data.length === 0 &&
    (!showCSounding || !cSoundingData || cSoundingData.length === 0) &&
    (!showIconD2 || !iconD2Data || iconD2Data.length === 0) &&
    (!showIconH || !iconHData || iconHData.length === 0) &&
    (!showGeoJson || !geoJsonData || geoJsonData.length === 0) &&
    (!showWyoming || !wyomingData || wyomingData.length === 0)
      ) {
    return <Text>No data available for Direction vs Altitude</Text>;
  }

  const altitudes = [
    ...(showCSounding && cSoundingData ? cSoundingData.map(point => point.altitude) : []),
    ...(showIconD2 && iconD2Data ? iconD2Data.map(point => point.altitude) : []),
	...(showIconH && iconHData ? iconHData.map(point => point.altitude) : []),
    ...(showGeoJson && geoJsonData ? geoJsonData.map(point => point.altitude) : []),
    ...(showWyoming && wyomingData ? wyomingData.map(point => point.altitude) : []),
    ...data.map(point => point.altitude)
  ];
  const minAltitude = altitudeMin ?? (altitudes.length > 0 ? Math.min(...altitudes) : userAltMin);
  const maxAltitude = altitudeMax ?? (altitudes.length > 0 ? Math.max(...altitudes) : userAltMax);
  const altitudeRange = maxAltitude - minAltitude || 1;

  const scaleAltitude = (altitude) => ((altitude - minAltitude) / altitudeRange) * radius;

  const plotPoints = (points, color, prefix, applyFilter = false) => {
    const filteredPoints = applyFilter ? points.filter((_, index) => index % OMIT_POINTS === 0) : points;
    return filteredPoints
      .filter(point => point.direction != null)
      .map((point, index) => {
        const angle = ((point.direction - 90) * Math.PI) / 180;
        const r = scaleAltitude(point.altitude);
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        return <Circle key={`${prefix}-${index}`} cx={x} cy={y} r={3} fill={color} stroke="black" strokeWidth="1.5" />;
      });
  };

  const altitudeLabels = [0.25, 0.5, 0.75, 1].map(fraction => (minAltitude + fraction * altitudeRange).toFixed(0));
  
  // Define three help lines at 25%, 50%, and 75% of the altitude range
  const helpLineFractions = [0.25, 0.5, 0.75];
  const helpLines = helpLineFractions.map(fraction => ({
    altitude: minAltitude + fraction * altitudeRange,
    radius: scaleAltitude(minAltitude + fraction * altitudeRange),
  }));

  return (
    <View style={styles.chartWrapper}>
      {(fetchError || wyomingFirstLine) && (
        <Text style={styles.errorText}>
          {fetchError ? fetchError : 'Wyoming Response:\n' + wyomingFirstLine}
        </Text>
      )}
      <Legend showCSounding={showCSounding} showIconD2={showIconD2} showIconH={showIconH} showGeoJson={showGeoJson} showWyoming={showWyoming} />
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75, 1].map((fraction, index) => {
          const r = fraction * radius;
          return (
            <React.Fragment key={`ring-${index}`}>
              <Circle cx={centerX} cy={centerY} r={r} stroke="gray" strokeWidth="0.5" fill="none" />
              <SvgText x={centerX + r + 5} y={centerY} fontSize="8" fontWeight="bold" textAnchor="start">{altitudeLabels[index]} m</SvgText>
            </React.Fragment>
          );
        })}
        {/* Add three help line circles */}
        {helpLines.map((line, index) => (
          <Circle
            key={`help-line-${index}`}
            cx={centerX}
            cy={centerY}
            r={line.radius}
            stroke="#d3d3d3"
            strokeWidth="0.5"
            fill="none"
          />
        ))}
        {[0, 90, 180, 270].map((angle) => {
          const displayAngle = (angle + 90) % 360;
          const rad = (angle * Math.PI) / 180;
          const x = centerX + radius * Math.cos(rad);
          const y = centerY + radius * Math.sin(rad);
          return (
            <SvgText key={`label-${angle}`} x={x} y={y} fontSize="8" fontWeight="bold" textAnchor="middle" dy={angle === 90 || angle === 270 ? 3 : 0}>
              {displayAngle}°
            </SvgText>
          );
        })}
        {showCSounding && cSoundingData && plotPoints(cSoundingData, "green", "csounding", false)}
        {showIconD2 && iconD2Data && plotPoints(iconD2Data, "blue", "icond2", false)}
		{showIconH && iconHData && plotPoints(iconHData, "#00CED1", "iconh", false)}
        {showGeoJson && geoJsonData && plotPoints(geoJsonData, "purple", "geojson", false)}
        {showWyoming && wyomingData && plotPoints(wyomingData, "#FFFF00", "wyoming", false)}
        {plotPoints(data, "rgba(255, 99, 132, 1)", "sensor", true)}
      </Svg>
      <Text style={styles.xAxisTitle}>Direction (°) vs Altitude (m)</Text>
    </View>
  );
});   // ←←← THIS MUST BE });   (with the extra closing parenthesis)

export default function App() {
  const [latestAltitude, setLatestAltitude] = useState(0);
  const [latestVSpeed, setLatestVSpeed] = useState(0);
  const [latestAcceleration, setLatestAcceleration] = useState(0);
  const [latestDirection, setLatestDirection] = useState(0);
  const [latestSpeed, setLatestSpeed] = useState(0);
  const [latestTemperature, setLatestTemperature] = useState(0);
  const [latestHumidity, setLatestHumidity] = useState(0);
  const [latestGpsDateTime, setLatestGpsDateTime] = useState('');
  const [latestLatitude, setLatestLatitude] = useState(0);
  const [latestLongitude, setLatestLongitude] = useState(0);
  const [vSpeedData, setVSpeedData] = useState([]);
  const [accelerationData, setAccelerationData] = useState([]);
  const [directionData, setDirectionData] = useState([]);
  const [speedData, setSpeedData] = useState([]);
  const [temperatureData, setTemperatureData] = useState([]);
  const [humidityData, setHumidityData] = useState([]);
  const [logData, setLogData] = useState([]);
  const [dataSource, setDataSource] = useState('http');
  const [isPaused, setIsPaused] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [cSoundingData, setCSoundingData] = useState([]);
  const [iconD2Data, setIconD2Data] = useState([]);
  const [geoJsonData, setGeoJsonData] = useState([]);
  const [wyomingData, setWyomingData] = useState([]);
  const [wyomingFirstLine, setWyomingFirstLine] = useState(null);
  const [showCSounding, setShowCSounding] = useState(false);
  const [showIconD2, setShowIconD2] = useState(false);
  const [iconHData, setIconHData] = useState([]);
  const [showIconH, setShowIconH] = useState(false);
  const [showGeoJson, setShowGeoJson] = useState(false);
  const [showWyoming, setShowWyoming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('icon_d2');
  const [isOutsideRegion, setIsOutsideRegion] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [userAltMin, setUserAltMin] = useState(ALT_MIN);
  const [userAltMax, setUserAltMax] = useState(ALT_MAX);

  const mqttClientRef = useRef(null);
  const requestClientRef = useRef(null);

  const handleAltMinChange = (value) => {
    let num = parseFloat(value);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 5000) num = 5000;
    if (num >= userAltMax) num = userAltMax - 500;
    setUserAltMin(Math.round(num / 500) * 500);
  };

  const handleAltMaxChange = (value) => {
    let num = parseFloat(value);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 5000) num = 5000;
    if (num <= userAltMin) num = userAltMin + 500;
    setUserAltMax(Math.round(num / 500) * 500);
  };

  const incrementAltMin = () => {
    const newValue = userAltMin + 500;
    if (newValue < userAltMax && newValue <= 5000) {
      setUserAltMin(newValue);
    }
  };

  const decrementAltMin = () => {
    const newValue = userAltMin - 500;
    if (newValue >= 0 && newValue < userAltMax) {
      setUserAltMin(newValue);
    }
  };

  const incrementAltMax = () => {
    const newValue = userAltMax + 500;
    if (newValue <= 5000) {
      setUserAltMax(newValue);
    }
  };

  const decrementAltMax = () => {
    const newValue = userAltMax - 500;
    if (newValue > userAltMin) {
      setUserAltMax(newValue);
    }
  };

  const processData = useCallback((data, elapsedTime) => {
    if (!data || typeof data !== 'object' || !('gpsDateTime' in data)) {
      console.warn('Invalid data structure:', data);
      setFetchError('Invalid data: missing gpsDateTime');
      return false;
    }

    const gpsDateTime = data.gpsDateTime ? data.gpsDateTime.replace('T', ' ') : '';
    if (!gpsDateTime) {
      console.warn('Invalid gpsDateTime:', data.gpsDateTime);
      setFetchError('Invalid gpsDateTime value');
      return false;
    }

	let altitude = parseFloat(data.Baro_Alt_m) || 0.0;

	if (!Number.isFinite(altitude)) {
	altitude = parseFloat(data.GPS_Alt_m) || 0;
	}

	if (altitude < 0) altitude = 0;

    const vSpeed = parseFloat(data.KalF_vSpeed) || 0.0;
    const acceleration = parseFloat(data.KalF_Acc) || 0.0;
    const direction = parseFloat(data.HDG_deg) || 0.0;
    const speed = parseFloat(data.GS_kt) || 0.0;
    const temperature = parseFloat(data.Atm_Temp) || 0.0;
    const humidity = parseFloat(data.Atm_Hum) || 0.0;
    const latitude = parseFloat(data.Lat_deg) || 0.0;
    const longitude = parseFloat(data.Lon_deg) || 0.0;

    if (isNaN(altitude) || isNaN(vSpeed) || isNaN(acceleration) || isNaN(direction) || isNaN(speed) || isNaN(temperature) || isNaN(humidity) || isNaN(latitude) || isNaN(longitude)) {
      console.warn('Invalid data received:', { altitude, vSpeed, acceleration, direction, speed, temperature, humidity, latitude, longitude });
      setFetchError('Invalid data values');
      return false;
    }

    if (altitude >= userAltMin && altitude <= userAltMax) {
      setLatestAltitude(altitude);
      setLatestVSpeed(vSpeed);
      setLatestAcceleration(acceleration);
      setLatestDirection(direction);
      setLatestSpeed(speed);
      setLatestTemperature(temperature);
      setLatestHumidity(humidity);
      setLatestGpsDateTime(gpsDateTime);
      setLatestLatitude(latitude);
      setLatestLongitude(longitude);

      setVSpeedData(prev => [...prev, { time: elapsedTime, vSpeed }].slice(-MAX_POINTS_ALT));
      setAccelerationData(prev => [...prev, { time: elapsedTime, acceleration }].slice(-MAX_POINTS_ACC));
      setDirectionData(prev => [...prev, { time: elapsedTime, direction, altitude }].slice(-MAX_POINTS_ALT));
      setSpeedData(prev => [...prev, { time: elapsedTime, speed, altitude }].slice(-MAX_POINTS_ALT));
      setTemperatureData(prev => [...prev, { time: elapsedTime, temperature, altitude }].slice(-MAX_POINTS_ALT));
      setHumidityData(prev => [...prev, { time: elapsedTime, humidity, altitude }].slice(-MAX_POINTS_ALT));

      setFetchError(null);
      return true;
    } else {
      console.warn(`Altitude ${altitude} out of range [${userAltMin}, ${userAltMax}]`);
      setFetchError(`Altitude out of range: ${altitude}`);
      return false;
    }
  }, [userAltMin, userAltMax]);

  const isWithinModelDomain = (lat, lon, model) => {
    if (lat === 0 && lon === 0) {
      console.log(`Coordinates are invalid (lat: ${lat}, lon: ${lon}), assuming outside region for model ${model}`);
      return false;
    }

    switch (model) {
      case 'icon_d2':
        return lat >= 47 && lat <= 55 && lon >= 5 && lon <= 15;
      case 'icon_eu':
        return lat >= 35 && lat <= 70 && lon >= -25 && lon <= 45;
      case 'arome':
        return lat >= 35 && lat <= 55 && lon >= -10 && lon <= 15;
      case 'arome_france_hd':
        return lat >= 41 && lat <= 52 && lon >= -5 && lon <= 10;
      case 'ecmwf':
      case 'gfs':
        return true;
      default:
        return true;
    }
  };

  useEffect(() => {
    console.log(`Checking region for model ${selectedModel} with coordinates lat=${latestLatitude}, lon=${latestLongitude}`);
    const outside = !isWithinModelDomain(latestLatitude, latestLongitude, selectedModel);
    console.log(`Is outside region for ${selectedModel}: ${outside}`);
    setIsOutsideRegion(outside);
  }, [latestLatitude, latestLongitude, selectedModel]);


  const fetchIconHData = async () => {
  try {
    console.log('Fetching ICON h-level data from:', LIVE_ICON_URL);

    const response = await fetch(LIVE_ICON_URL);

    if (!response.ok)
      throw new Error(`HTTP error ${response.status}`);

    const data = await response.json();

    console.log(
      'Fetched ICON h-level data:',
      data.features.slice(0, 5)
    );

    const processedData = data.features
      .filter(
        feature =>
          feature.type === 'Feature' &&
          feature.geometry.type === 'Point'
      )
      .map(feature => {

        const props = feature.properties;

		  
		let altitude =
          props.gpheight ??
          feature.geometry.coordinates?.[2] ??
          0;

        if (altitude < 0) altitude = 0;

        const temp_k = props.temp;
        const dewpoint_k = props.dewpoint;

        const rawDirection =
              props.windDirDeg ??
              props.wdir_deg ??
              props.direction ??
        null;

        const direction =
              rawDirection != null ? (rawDirection + 180) % 360 : null;

        const speed =
              props.windSpeedKn ??
              props.wspd_kn ??
              props.speed ??
        null;
        
        const temperature =
          temp_k ? temp_k - 273.15 : null;

        let humidity = null;

        if (temp_k && dewpoint_k) {

          const temp_c = temp_k - 273.15;
          const dewpoint_c = dewpoint_k - 273.15;

          const e_s =
            6.1078 *
            Math.pow(
              10,
              (7.5 * temp_c) /
                (temp_c + 237.3)
            );

          const e =
            6.1078 *
            Math.pow(
              10,
              (7.5 * dewpoint_c) /
                (dewpoint_c + 237.3)
            );

          humidity = (e / e_s) * 100;
        }

        return {
          altitude,
          temperature,
          humidity,
          speed,
          direction
        };

      })
      .filter(
        point =>
          point.altitude >= userAltMin &&
          point.altitude <= userAltMax &&
          point.temperature != null &&
          point.humidity != null
      );

    console.log(
      'Processed ICON h-level data:',
      processedData
    );

    setIconHData(processedData);

    setFetchError(null);

  } catch (err) {

    console.error(
      'Error fetching ICON h-level data:',
      err
    );

    setIconHData([]);

    setFetchError(
      'Failed to fetch ICON h-level data: ' +
      err.message
    );
  }
  };

  const fetchGeoJsonData = async () => {
    try {
      console.log('Fetching GeoJSON data from:', GEOJSON_FILE_URL);
      const response = await fetch(GEOJSON_FILE_URL);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      console.log('Fetched GeoJSON data:', data.features.slice(0, 5));

      const processedData = data.features
        .filter(feature => feature.type === 'Feature' && feature.geometry.type === 'Point')
        .map(feature => {
          const props = feature.properties;
          const altitude = props.gpheight || feature.geometry.coordinates[2];
          const temp_k = props.temp;
          const dewpoint_k = props.dewpoint;
          
          
          const rawDirection =
                props.windDirDeg ??
                props.wdir_deg ??
                props.direction ??
          null;

          const direction =
                rawDirection != null ? (rawDirection + 180) % 360 : null;

          const speed =
                props.windSpeedKn ??
                props.wspd_kn ??
                props.speed ??
          null;
          // Temperature in °C
          const temperature = temp_k ? temp_k - 273.15 : null;

          // Relative Humidity
          let humidity = null;
          if (temp_k && dewpoint_k) {
            const temp_c = temp_k - 273.15;
            const dewpoint_c = dewpoint_k - 273.15;
            const e_s = 6.1078 * Math.pow(10, (7.5 * temp_c) / (temp_c + 237.3));
            const e = 6.1078 * Math.pow(10, (7.5 * dewpoint_c) / (dewpoint_c + 237.3));
            humidity = (e / e_s) * 100;
          }

          // Wind Speed (knots) and Direction (optional)
          // let speed = null;
          // let direction = null;
          // if (wind_u != null && wind_v != null) {
          //  speed = Math.sqrt(wind_u * wind_u + wind_v * wind_v) * 1.94384; // m/s to knots
          //  direction = (270 - (Math.atan2(wind_v, wind_u) * 180 / Math.PI)) % 360; // Meteorological   direction   
          // speed = wind_v;
          // direction = wind_u;
          // }

          return {
            altitude,
            temperature,
            humidity,
            speed,
            direction
          };
        })
        .filter(point => 
          point.altitude >= userAltMin && 
          point.altitude <= userAltMax && 
          point.temperature != null && 
          point.humidity != null
        );

      console.log('Processed GeoJSON data (all points):', processedData);
      setGeoJsonData(processedData);
      setFetchError(null);
    } catch (err) {
      console.error('Error fetching GeoJSON data:', err);
      setGeoJsonData([]);
      setFetchError('Failed to fetch GeoJSON data: ' + err.message);
    }
  };

  const fetchWyomingData = async () => {
    try {
      console.log('Fetching Wyoming data from:', WYOMING_URL);
      const response = await fetch(WYOMING_URL);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const text = await response.text();
      console.log('Full response from Wyoming (first 1000 chars):', text.substring(0, 1000));

      const lines = text.split('\n').filter(line => line.trim() !== '');
      console.log('First 5 lines:', lines.slice(0, 5));

      // Since data has no header, assume fixed order based on Wyoming format
      const headers = ['PRES', 'HGHT', 'TEMP', 'DWPT', 'RELH', 'MIXR', 'DRCT', 'SPED', 'THTA', 'THTE', 'THTV'];
      const headerMapping = {
        'PRES': 'pressure',
        'HGHT': 'altitude',
        'TEMP': 'temperature',
        'DWPT': 'dewpoint',
        'RELH': 'humidity',
        'DRCT': 'direction',
        'SPED': 'speed'
      };

      const data = lines.map(line => {
        const values = line.trim().split(/\s+/).map(v => v.trim());
        if (values.length < headers.length) return null;
        return headers.reduce((obj, header, index) => {
          const key = headerMapping[header] || header;
          let value = parseFloat(values[index]);
          obj[key] = isNaN(value) ? null : (key === 'speed' ? value * 1.94384 : value); // Convert m/s to knots
          return obj;
        }, {});
      }).filter(point => point !== null);

      console.log('Parsed data (first 5):', data.slice(0, 5));
      console.log('Total parsed points:', data.length);

      const processedData = data.map(point => ({
        altitude: point.altitude,
        temperature: point.temperature,
        humidity: point.humidity,
        speed: point.speed,
        direction: point.direction != null ? (point.direction + 180) % 360 : null // Adjust direction for drift
    })).filter(point =>
//        direction: point.direction
//      })).filter(point => 
        point.altitude != null && 
        point.altitude >= userAltMin && 
        point.altitude <= userAltMax && 
        point.temperature != null && 
        point.humidity != null
      );

      console.log('Processed Wyoming data (first 5):', processedData.slice(0, 5));
      console.log('Total processed points:', processedData.length);

      if (processedData.length === 0) {
        setWyomingFirstLine(lines.slice(0, 3).join('\n') || 'No data available after filtering');
        console.warn('No valid data points after processing');
      } else {
        setWyomingFirstLine(null);
      }
      setWyomingData(processedData);
      setFetchError(null);
    } catch (err) {
      console.error('Error in fetchWyomingData:', err);
      setWyomingData([]);
      setWyomingFirstLine('Fetch failed: ' + err.message);
      setFetchError('Failed to fetch Wyoming data: ' + err.message);
    }
  };

  const fetchIconD2Weather = async (latitude, longitude, model) => {
    console.log('Fetch Weather Data button clicked', { latitude, longitude, model });
    if (latitude === 0 && longitude === 0) {
      console.warn('Invalid coordinates for weather fetch:', { latitude, longitude });
      setFetchError('Cannot fetch weather: Invalid coordinates (0, 0)');
      return;
    }

    if (!isWithinModelDomain(latitude, longitude, model)) {
      console.warn(`Coordinates outside ${model} domain:`, { latitude, longitude });
      setFetchError(`Cannot fetch weather: Coordinates outside ${model.toUpperCase()} region`);
      return;
    }

    const lat = latitude;
    const lon = longitude;

    const levels = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500];
    const variables = levels.flatMap(level => [
      `temperature_${level}hPa`,
      `relative_humidity_${level}hPa`,
      `wind_speed_${level}hPa`,
      `wind_direction_${level}hPa`,
      `geopotential_height_${level}hPa`
    ]);

    const hourlyVars = variables.join(',');
    let url;
    switch (model) {
      case 'ecmwf':
        url = `https://api.open-meteo.com/v1/ecmwf?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}`;
        break;
      case 'gfs':
        url = `https://api.open-meteo.com/v1/gfs?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}`;
        break;
      case 'icon_eu':
        url = `https://api.open-meteo.com/v1/dwd-icon?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}&models=icon_eu`;
        break;
      case 'arome':
        url = `https://api.open-meteo.com/v1/meteofrance?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}&models=arome_france`;
        break;
      case 'arome_france_hd':
        url = `https://api.open-meteo.com/v1/meteofrance?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}&models=arome_france_hd`;
        break;
      case 'icon_d2':
        url = `https://api.open-meteo.com/v1/dwd-icon?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}&models=icon_d2`;
        break;
      default:
        url = `https://api.open-meteo.com/v1/dwd-icon?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}&models=icon_d2`;
        break;
    }

    try {
      console.log(`Fetching ${model.toUpperCase()} data with URL:`, url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error ${response.status}: ${errorText}`);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`${model.toUpperCase()} API response:`, data);

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const targetTime = `${year}-${month}-${day}T${hour}:00`;

      const index = data.hourly.time.findIndex(t => t === targetTime);
      console.log('Target time:', targetTime, 'Index found:', index);

      if (index === -1) {
        throw new Error('No data available for current hour');
      }

      let weatherData = levels.map(level => ({
        altitude: data.hourly[`geopotential_height_${level}hPa`][index],
        temperature: data.hourly[`temperature_${level}hPa`][index],
        humidity: data.hourly[`relative_humidity_${level}hPa`][index],
        speed: data.hourly[`wind_speed_${level}hPa`][index] * 0.539957,
        direction: (data.hourly[`wind_direction_${level}hPa`][index] + 180) % 360
      }));

      weatherData = weatherData.filter(point => 
        point.altitude >= userAltMin && point.altitude <= userAltMax && 
        point.temperature != null && point.humidity != null && 
        point.speed != null && point.direction != null
      );

      console.log(`Filtered ${model.toUpperCase()} weather data:`, weatherData);

      setIconD2Data(weatherData);
      setShowIconD2(true);
      setFetchError(null);
    } catch (error) {
      console.error(`Error fetching ${model.toUpperCase()} data:`, error);
      const errorMessage = error.name === 'AbortError'
        ? `Failed to fetch ${model.toUpperCase()} data: Request timed out after 5 seconds`
        : `Failed to fetch ${model.toUpperCase()} data: ${error.message}`;
      setFetchError(errorMessage);
    }
  };

  useEffect(() => {
    const fetchLogData = async () => {
      try {
        const response = await fetch(LOG_FILE_URL);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const data = lines.map(line => {
          const point = JSON.parse(line);
          return {
            Runtime: parseFloat(point.Runtime) || 0,
            Baro_Alt_m: parseFloat(point.Baro_Alt_m) || 0,
            VAR_Kal_m_s: parseFloat(point.VAR_Kal_m_s) || 0,
            meanACC_Kal_m_s2: parseFloat(point.meanACC_Kal_m_s2) || 0,
            HDG_deg: parseFloat(point.HDG_deg) || 0,
            GS_kt: parseFloat(point.GS_kt) || 0,
            Envelope_Temp_Deg: parseFloat(point.Envelope_Temp_Deg) || 0,
            varioVar_m_s: parseFloat(point.varioVar_m_s) || 0,
            Date: point.Date || '',
            Time: point.Time || '',
            Lat_deg: parseFloat(point.Lat_deg) || 0,
            Lon_deg: parseFloat(point.Lon_deg) || 0,
          };
        }).filter(point => !isNaN(point.Runtime) && !isNaN(point.Baro_Alt_m));
        console.log('Parsed log data:', data.slice(0, 5));
        setLogData(data.sort((a, b) => a.Runtime - b.Runtime));
        setFetchError(null);
      } catch (err) {
        console.error('Error fetching log data:', err);
        setLogData([]);
        setFetchError('Failed to fetch log data.');
      }
    };
    fetchLogData();
  }, []);

  useEffect(() => {
  if (showCSounding && !cSoundingData.length) {
    const fetchCSoundingData = async () => {
      try {
        console.log('Fetching cSounding data from:', WEATHER_FILE_URL);
        const response = await fetch(WEATHER_FILE_URL);
        console.log('Fetch response status:', response.status);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const text = await response.text();
        console.log('Fetched text (first 100 chars):', text.substring(0, 100));
        const lines = text.split('\n').filter(line => line.trim() !== '');
        // Skip the header line and process only data lines
        const dataLines = lines.slice(1); // Skip the first line
        const data = dataLines.map(line => {
          const values = line.split(',').map(v => v.trim());
          if (values.length !== 7) return null; // Expect 7 values per line
          return {
            altitude: parseFloat(values[0]),
            direction: parseFloat(values[1]),
            speed: parseFloat(values[2]) * 0.539957, // Convert km/h to knots
            pressure: parseFloat(values[3]),
            temperature: parseFloat(values[4]),
            dewPoint: parseFloat(values[5]),
            humidity: parseFloat(values[6]),
          };
        }).filter(point => point !== null && point.altitude >= userAltMin && point.altitude <= userAltMax);
        console.log('Parsed cSounding data:', data.slice(0, 5));
        console.log('Filtered cSounding data length:', data.length);
        setCSoundingData(data);
        setFetchError(null);
      } catch (err) {
        console.error('Error fetching cSounding data:', err.message);
        setCSoundingData([]);
        setFetchError('Failed to fetch cSounding data: ' + err.message);
      }
    };
    fetchCSoundingData();
  }
}, [showCSounding, userAltMin, userAltMax]);
  
  const resetDataState = useCallback(() => {
    setVSpeedData([]);
    setAccelerationData([]);
    setDirectionData([]);
    setSpeedData([]);
    setTemperatureData([]);
    setHumidityData([]);
    setLatestAltitude(0);
    setLatestVSpeed(0);
    setLatestAcceleration(0);
    setLatestDirection(0);
    setLatestSpeed(0);
    setLatestTemperature(0);
    setLatestHumidity(0);
    setLatestGpsDateTime('');
  //  setLatestLatitude(0);
  //  setLatestLongitude(0);
    setFetchError(null);
    setConnectionStatus('Disconnected');
  }, []);

  const switchDataSource = useCallback((source) => {
    console.log('Switching data source to:', source);
    resetDataState();
    setDataSource(source);
    setIsPaused(false);
  }, [resetDataState]);

  const toggleCSounding = useCallback(() => {
    setShowCSounding(prev => !prev);
  }, []);

  const toggleIconD2 = useCallback(() => {
    setShowIconD2(prev => !prev);
  }, []);

  const toggleIconH = useCallback(() => {
  if (!showIconH && iconHData.length === 0) {
    fetchIconHData();
  }
  setShowIconH(prev => !prev);
  }, [showIconH, iconHData]);
  
  
  const toggleGeoJson = useCallback(() => {
    if (!showGeoJson && geoJsonData.length === 0) {
      fetchGeoJsonData();
    }
    setShowGeoJson(prev => !prev);
  }, [showGeoJson, geoJsonData]);

  const toggleWyoming = useCallback(() => {
    if (!showWyoming && wyomingData.length === 0) {
      fetchWyomingData();
    }
    setShowWyoming(prev => !prev);
  }, [showWyoming, wyomingData]);

  const pauseReplay = useCallback(() => {
    console.log('Pausing replay');
    setIsPaused(true);
  }, []);

  const continueReplay = useCallback(() => {
    console.log('Continuing replay');
    setIsPaused(false);
  }, []);

  useEffect(() => {
  const requestClient = mqtt.connect(MQTT_BROKER, {
    clientId: `balloon_request_${Date.now()}`,
    username: MQTT_USER,
    password: MQTT_PASS,
    reconnectPeriod: 1000,
    connectTimeout: 5000,
    clean: true,
  });

  requestClient.on('connect', () => {
    console.log('MQTT request channel connected');
  });

  requestClient.on('reconnect', () => {
    console.log('MQTT request channel reconnecting...');
  });

  requestClient.on('offline', () => {
    console.log('MQTT request channel offline');
  });

  requestClient.on('close', () => {
    console.log('MQTT request channel closed');
  });

  requestClient.on('error', (error) => {
    console.error('MQTT request channel error:', error);
  });

  requestClientRef.current = requestClient;

  return () => {
    if (requestClientRef.current) {
      requestClientRef.current.end(true, () => {
        console.log('MQTT request client closed');
      });
      requestClientRef.current = null;
    }
  };
}, []);

  // === ON-DEMAND SOUNDING REQUEST ===
    const requestLiveSounding = useCallback(() => {
  const client = requestClientRef.current;

  if (!client || client.connected !== true) {
    console.warn('MQTT request client not connected');
    setFetchError('MQTT request channel not connected');
    return;
  }

  if (
    !Number.isFinite(latestLatitude) ||
    !Number.isFinite(latestLongitude) ||
    latestLatitude === 0 ||
    latestLongitude === 0
  ) {
    console.warn('No valid GPS position available for sounding request');
    setFetchError('No valid GPS position yet - cannot request sounding');
    return;
  }

  const payload = {
    Lat_deg: latestLatitude,
    Lon_deg: latestLongitude,
    gpsDateTime: latestGpsDateTime || new Date().toISOString(),
    Baro_Alt_m: latestAltitude,
    HDG_deg: latestDirection,
    GS_kt: latestSpeed,
    request_type: 'sounding'
  };

  client.publish(
    MQTT_TOPIC_REQUEST,
    JSON.stringify(payload),
    { qos: 1 },
    (err) => {
      if (err) {
        console.error('Publish failed:', err);
        setFetchError('Failed to send request to service');
      } else {
        console.log('✅ Sent sounding request to service:', payload);
        setFetchError(null);
        if (!showIconH) {
          setShowIconH(true);
        }
        fetchIconHData();
      }
    }
  );
}, [
  latestLatitude,
  latestLongitude,
  latestGpsDateTime,
  latestAltitude,
  latestDirection,
  latestSpeed,
  showIconH
]);
  
  useEffect(() => {
    if (dataSource !== 'http') return;
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms));
    const intervalId = setInterval(async () => {
      try {
//        console.log('Fetching live data from http://192.168.4.1/readings');
//        const response = await Promise.race([
//         fetch('http://192.168.4.1/readings', { signal: controller.signal, headers: { 'Accept': 'application/json' } }),

        console.log('Fetching live data from http://172.20.10.7/readings');
        const response = await Promise.race([
          fetch('http://172.20.10.7/readings', { signal: controller.signal, headers: { 'Accept': 'application/json' } }),


//        console.log('Fetching live data from http://192.168.88.51/readings');
//        const response = await Promise.race([
//          fetch('http://192.168.88.51/readings', { signal: controller.signal, headers: { 'Accept': 'application/json' } }),
          timeout(5000),
        ]);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        console.log('Fetched HTTP data:', data);
        processData(data, (Date.now() - startTime) / 1000);
      } catch (error) {
        console.error('HTTP fetch error:', error);
        setFetchError(`HTTP fetch failed: ${error.message}`);
      }
    }, 1000);
    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [dataSource, processData]);

  useEffect(() => {
    if (dataSource !== 'replay' || logData.length === 0 || isPaused) {
      console.log('Replay useEffect skipped:', { dataSource, logDataLength: logData.length, isPaused });
      return;
    }
    console.log('Starting replay with logData:', logData.slice(0, 5));
    let index = 0;
    const t0 = logData[0].Runtime || 0;
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const simulatedTime = t0 + (elapsedMs / 1000) * time_factor;
      console.log('Replay tick:', { index, simulatedTime, totalPoints: logData.length });
      while (index < logData.length && logData[index].Runtime <= simulatedTime) {
        const point = logData[index];
        const altitude = point.Baro_Alt_m;
        if (altitude >= userAltMin && altitude <= userAltMax) {
          console.log('Processing replay point:', point);
          setVSpeedData(prev => [...prev, { time: point.Runtime, vSpeed: point.VAR_Kal_m_s }].slice(-MAX_POINTS_ALT));
          setAccelerationData(prev => [...prev, { time: point.Runtime, acceleration: point.meanACC_Kal_m_s2 }].slice(-MAX_POINTS_ACC));
          setDirectionData(prev => [...prev, { time: point.Runtime, direction: point.HDG_deg, altitude }].slice(-MAX_POINTS_ALT));
          setSpeedData(prev => [...prev, { time: point.Runtime, speed: point.GS_kt, altitude }].slice(-MAX_POINTS_ALT));
          setTemperatureData(prev => [...prev, { time: point.Runtime, temperature: point.Envelope_Temp_Deg, altitude }].slice(-MAX_POINTS_ALT));
          setHumidityData(prev => [...prev, { time: point.Runtime, humidity: point.varioVar_m_s, altitude }].slice(-MAX_POINTS_ALT));
          setLatestAltitude(altitude);
          setLatestVSpeed(point.VAR_Kal_m_s);
          setLatestAcceleration(point.meanACC_Kal_m_s2);
          setLatestDirection(point.HDG_deg);
          setLatestSpeed(point.GS_kt);
          setLatestTemperature(point.Envelope_Temp_Deg);
          setLatestHumidity(point.varioVar_m_s);
          setLatestGpsDateTime(`${point.Date} ${point.Time}`);
          setLatestLatitude(point.Lat_deg || 0);
          setLatestLongitude(point.Lon_deg || 0);
        }
        index++;
      }
      if (index >= logData.length) {
        console.log('Replay completed, switching to HTTP');
        clearInterval(intervalId);
        setDataSource('http');
        setIsPaused(false);
      }
    }, 100);
    return () => {
      console.log('Cleaning up replay interval');
      clearInterval(intervalId);
    };
  }, [dataSource, isPaused, logData, userAltMin, userAltMax]);

  useEffect(() => {
    if (dataSource !== 'mqtt') {
      if (mqttClientRef.current) {
        console.log('Cleaning up existing MQTT client');
        mqttClientRef.current.end(true, () => {
          console.log('MQTT client closed');
        });
        mqttClientRef.current = null;
        setConnectionStatus('Disconnected');
      }
      return;
    }

    console.log('Initiating MQTT connection to:', MQTT_BROKER);
    setConnectionStatus('Connecting...');
    const client = mqtt.connect(MQTT_BROKER, {
      clientId: MQTT_CLIENT_ID,
      username: MQTT_USER,
      password: MQTT_PASS,
      reconnectPeriod: 1000,
      connectTimeout: 5000,
    });

    client.on('connect', () => {
      console.log('MQTT connected successfully');
      setConnectionStatus('Connected');
      setFetchError(null);
      client.subscribe(MQTT_TOPIC, (err) => {
        if (err) {
          console.error('MQTT subscription error:', err);
          setFetchError('MQTT subscription failed: ' + err.message);
          setConnectionStatus('Subscription failed');
        } else {
          console.log('Subscribed to:', MQTT_TOPIC);
        }
      });
    });

    client.on('message', (topic, message) => {
      if (topic === MQTT_TOPIC) {
        try {
          const data = JSON.parse(message.toString());
          console.log('Received MQTT message:', data);
          processData(data, data.runtime || 0);
        } catch (error) {
          console.error('MQTT message parse error:', error);
          setFetchError('Error parsing MQTT message: ' + error.message);
        }
      }
    });

    client.on('error', (error) => {
      console.error('MQTT connection error:', error);
      setFetchError('MQTT error: ' + error.message);
      setConnectionStatus('Connection failed');
    });

    client.on('close', () => {
      console.log('MQTT connection closed');
      setConnectionStatus('Disconnected');
    });

    client.on('offline', () => {
      console.log('MQTT client offline');
      setConnectionStatus('Offline');
    });

    mqttClientRef.current = client;

    return () => {
      if (mqttClientRef.current) {
        console.log('Cleaning up MQTT client on unmount');
        mqttClientRef.current.end(true, () => {
          console.log('MQTT client closed on unmount');
        });
        mqttClientRef.current = null;
      }
    };
  }, [dataSource, processData]);

  const screenWidth = Dimensions.get('window').width;
  const cellWidth = (screenWidth - 60) / 3;
  const cellHeight = (Dimensions.get('window').height - 100) / 2;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.gridRow}>
        <View style={[styles.gridCell, { width: cellWidth }]}>
          <View style={styles.textContent}>
            <Text style={styles.numericTitle}>hlballon Flight Display v:260402</Text>
            <Text style={styles.gpsDateTime}>
              Time: {latestGpsDateTime} | Lat: {latestLatitude.toFixed(4)}°, Long: {latestLongitude.toFixed(4)}°
            </Text>
            <Text style={styles.dataSourceText}>Data Source: {dataSource.toUpperCase()}</Text>
            {dataSource === 'mqtt' && <Text style={styles.connectionStatus}>MQTT Status: {connectionStatus}</Text>}
            <View style={styles.tableRow}><Text style={styles.label}>Altitude</Text><Text style={styles.value}>{latestAltitude.toFixed(2)}</Text><Text style={styles.unit}>m</Text></View>
            <View style={styles.tableRow}><Text style={styles.label}>v_Speed</Text><Text style={styles.value}>{latestVSpeed.toFixed(2)}</Text><Text style={styles.unit}>m/s</Text></View>
            <View style={styles.tableRow}><Text style={styles.label}>Acceleration</Text><Text style={styles.value}>{latestAcceleration.toFixed(3)}</Text><Text style={styles.unit}>m/s²</Text></View>
            <View style={styles.tableRow}><Text style={styles.label}>Direction</Text><Text style={styles.value}>{latestDirection.toFixed(2)}</Text><Text style={styles.unit}>°</Text></View>
            <View style={styles.tableRow}><Text style={styles.label}>Speed</Text><Text style={styles.value}>{latestSpeed.toFixed(2)}</Text><Text style={styles.unit}>kt</Text></View>
            <View style={styles.tableRow}><Text style={styles.label}>Temperature</Text><Text style={styles.value}>{latestTemperature.toFixed(2)}</Text><Text style={styles.unit}>°C</Text></View>
            <View style={styles.tableRow}><Text style={styles.label}>Humidity</Text><Text style={styles.value}>{latestHumidity.toFixed(2)}</Text><Text style={styles.unit}>%</Text></View>
          </View>
          <View style={[styles.buttonContainer, { zIndex: 10 }]}>
            <Button
              title={dataSource === 'http' ? 'Switch to Replay' : dataSource === 'replay' ? 'Switch to HTTP' : 'Switch to HTTP'}
              onPress={() => {
                console.log('Switch to HTTP/Replay button clicked');
                switchDataSource(dataSource === 'http' ? 'replay' : 'http');
              }}
            />
            <Button
              title={dataSource === 'mqtt' ? 'Switch to HTTP' : 'Switch to MQTT'}
              onPress={() => {
                console.log('Switch to MQTT button clicked');
                switchDataSource(dataSource === 'mqtt' ? 'http' : 'mqtt');
              }}
              color="#FF4500"
            />
            {dataSource === 'replay' && (
              <Button
                title={isPaused ? "Continue" : "Pause"}
                onPress={() => {
                  console.log(isPaused ? 'Continue button clicked' : 'Pause button clicked');
                  isPaused ? continueReplay() : pauseReplay();
                }}
                color="#FFFF00"
              />
            )}
          </View>
          <View style={[styles.weatherButtonContainer, { zIndex: 10 }]}>
            <Button
              title={showWyoming ? "Hide Wyoming Sounding" : "Show Wyoming Sounding"}
              onPress={() => {
                console.log('Toggle Wyoming button clicked');
                toggleWyoming();
              }}
              color="#FFFF00"
            />
            <Button
              title={showGeoJson ? "Hide GeoJSON Sounding" : "Show GeoJSON Sounding"}
              onPress={() => {
                console.log('Toggle GeoJSON button clicked');
                toggleGeoJson();
              }}
              color="#800080"
            />
            <Button
              title={showCSounding ? "Hide composed Sounding" : "Show composed Sounding"}
              onPress={() => {
                console.log('Toggle cSounding button clicked');
                toggleCSounding();
              }}
              color="#006400"
            />
			
            <Button
            title={showIconH ? "Hide Live ICON Sounding" : "Fetch Live Sounding"}
            onPress={() => {
              if (!showIconH) {
              requestLiveSounding();
            } else {
            setShowIconH(false);
            }
            }}
              color="#00CED1"
            />
			
            <Button
              title={showIconD2 ? "Hide Selected Model" : "Fetch Weather Data"}
              onPress={() => {
                console.log('Fetch Weather Data button clicked', { showIconD2 });
                showIconD2 ? toggleIconD2() : fetchIconD2Weather(latestLatitude, latestLongitude, selectedModel);
              }}
              color="#4682B4"
            />
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedModel}
                style={styles.picker}
                onValueChange={(itemValue) => {
                  console.log('Model picker changed to:', itemValue);
                  setSelectedModel(itemValue);
                }}
              >
                <Picker.Item label="ICON-D2" value="icon_d2" />
                <Picker.Item label="ECMWF" value="ecmwf" />
                <Picker.Item label="GFS" value="gfs" />
                <Picker.Item label="ICON-EU" value="icon_eu" />
                <Picker.Item label="AROME-HD (1.3 km)" value="arome_france_hd" />
                <Picker.Item label="AROME (2.5 km)" value="arome" />
              </Picker>
            </View>
          </View>
          <View style={styles.altitudeInputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Max Alt (m)</Text>
              <View style={styles.inputRow}>
                <Button title="-" onPress={decrementAltMax} color="#FF4500" />
                <TextInput
                  style={styles.altitudeInput}
                  value={userAltMax.toString()}
                  onChangeText={handleAltMaxChange}
                  keyboardType="numeric"
                  placeholder="4500"
                />
                <Button title="+" onPress={incrementAltMax} color="#4682B4" />
              </View>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Min Alt (m)</Text>
              <View style={styles.inputRow}>
                <Button title="-" onPress={decrementAltMin} color="#FF4500" />
                <TextInput
                  style={styles.altitudeInput}
                  value={userAltMin.toString()}
                  onChangeText={handleAltMinChange}
                  keyboardType="numeric"
                  placeholder="0"
                />
                <Button title="+" onPress={incrementAltMin} color="#4682B4" />
              </View>
            </View>
          </View>
        </View>
        <PolarPlot 
          data={directionData} 
          cSoundingData={cSoundingData} 
          iconD2Data={iconD2Data} 
		  iconHData={iconHData}
          geoJsonData={geoJsonData}
          wyomingData={wyomingData}
          showCSounding={showCSounding} 
          showIconD2={showIconD2} 
		  showIconH={showIconH}
          showGeoJson={showGeoJson}
          showWyoming={showWyoming}
          width={cellWidth} 
          height={cellHeight} 
          altitudeMin={userAltMin} 
          altitudeMax={userAltMax} 
          userAltMin={userAltMin}
          userAltMax={userAltMax}
          fetchError={fetchError}
          wyomingFirstLine={wyomingFirstLine}
		 
		  
        />
        <ScatterPlot 
          data={temperatureData} 
          width={cellWidth} 
          height={cellHeight} 
          xTitle="Temperature (°C)" 
          yTitle="Altitude (m)" 
          xField="temperature" 
          yField="altitude" 
          yMin={userAltMin} 
          yMax={userAltMax} 
          cSoundingData={cSoundingData.map(point => ({ temperature: point.temperature, altitude: point.altitude }))} 
          iconD2Data={iconD2Data.map(point => ({ temperature: point.temperature, altitude: point.altitude }))} 
          geoJsonData={geoJsonData.map(point => ({ temperature: point.temperature, altitude: point.altitude }))}
          wyomingData={wyomingData.map(point => ({ temperature: point.temperature, altitude: point.altitude }))}
          showCSounding={showCSounding} 
          showIconD2={showIconD2} 
          showGeoJson={showGeoJson}
		  iconHData={iconHData.map(point => ({	temperature: point.temperature,	altitude: point.altitude }))}
		  showIconH={showIconH}
          showWyoming={showWyoming}
          userAltMin={userAltMin}
          userAltMax={userAltMax}
        />
      </View>
      <View style={styles.gridRow}>
        <ScatterPlot 
          data={accelerationData} 
          width={cellWidth} 
          height={cellHeight} 
          xTitle="Time (s)" 
          yTitle="Accel (m/s²)" 
          xField="time" 
          yField="acceleration" 
          showCSounding={false} 
          showIconD2={false} 
          showGeoJson={false}
          showWyoming={false}
          userAltMin={userAltMin}
          userAltMax={userAltMax}
        />
        <ScatterPlot 
          data={speedData} 
          width={cellWidth} 
          height={cellHeight} 
          xTitle="Speed (kt)" 
          yTitle="Altitude (m)" 
          xField="speed" 
          yField="altitude" 
          yMin={userAltMin} 
          yMax={userAltMax} 
          cSoundingData={cSoundingData.map(point => ({ speed: point.speed, altitude: point.altitude }))} 
          iconD2Data={iconD2Data.map(point => ({ speed: point.speed, altitude: point.altitude }))} 
		  iconHData={iconHData.map(point => ({ speed: point.speed, altitude: point.altitude }))}
          geoJsonData={geoJsonData.map(point => ({ speed: point.speed, altitude: point.altitude }))}
          wyomingData={wyomingData.map(point => ({ speed: point.speed, altitude: point.altitude }))}
          showCSounding={showCSounding} 
          showIconD2={showIconD2} 
		  showIconH={showIconH}
          showGeoJson={showGeoJson}
          showWyoming={showWyoming}
          userAltMin={userAltMin}
          userAltMax={userAltMax}
        />
        <ScatterPlot 
          data={humidityData} 
          width={cellWidth} 
          height={cellHeight} 
          xTitle="Humidity (%)" 
          yTitle="Altitude (m)" 
          xField="humidity" 
          yField="altitude" 
          yMin={userAltMin} 
          yMax={userAltMax} 
          cSoundingData={cSoundingData.map(point => ({ humidity: point.humidity, altitude: point.altitude }))} 
          iconD2Data={iconD2Data.map(point => ({ humidity: point.humidity, altitude: point.altitude }))} 
		  iconHData={iconHData.map(point => ({ humidity: point.humidity, altitude: point.altitude }))}
          geoJsonData={geoJsonData.map(point => ({ humidity: point.humidity, altitude: point.altitude }))}
          wyomingData={wyomingData.map(point => ({ humidity: point.humidity, altitude: point.altitude }))}
          showCSounding={showCSounding} 
          showIconD2={showIconD2} 
		  showIconH={showIconH}
          showGeoJson={showGeoJson}
          showWyoming={showWyoming}
          userAltMin={userAltMin}
          userAltMax={userAltMax}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  gridCell: { position: 'relative', justifyContent: 'flex-start', alignItems: 'center', backgroundColor: '#e8e8e8', borderRadius: 5, paddingVertical: 10, flex: 1 },
  textContent: { flex: 1, width: '100%', alignItems: 'center', paddingBottom: 90 },
  weatherButtonContainer: { position: 'absolute', bottom: 10, right: 10, width: 150 },
  buttonContainer: { position: 'absolute', bottom: 10, left: 10, width: 120, alignItems: 'flex-start' },
  numericTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  referenceText: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  gpsDateTime: { fontSize: 14, marginBottom: 5, textAlign: 'left', width: '100%' },
  dataSourceText: { fontSize: 14, marginBottom: 10, textAlign: 'left', width: '100%', fontWeight: 'bold' },
  connectionStatus: { fontSize: 14, marginBottom: 10, textAlign: 'left', width: '100%', color: '#FF4500' },
  tableRow: { flexDirection: 'row', marginVertical: 2, width: '100%', justifyContent: 'flex-start' },
  label: { fontSize: 16, width: 100, textAlign: 'left' },
  value: { fontSize: 16, width: 80, textAlign: 'right' },
  unit: { fontSize: 16, width: 40, textAlign: 'left', paddingLeft: 5 },
  chartWrapper: { alignItems: 'center' },
  yAxisTitle: { fontSize: 10, fontWeight: 'bold', transform: [{ rotate: '-90deg' }], position: 'absolute', left: -50, top: 180, width: 100, textAlign: 'center' },
  xAxisTitle: { fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginTop: 5 },
  errorText: { color: 'red', textAlign: 'center', marginVertical: 5, fontSize: 10 },
  legendContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center', 
    marginBottom: 5 
  },
  legendItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginHorizontal: 5 
  },
  legendDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    marginRight: 4 
  },
  legendText: { 
    fontSize: 8, 
    color: '#333' 
  },
  pickerContainer: {
    width: 150,
    marginBottom: 5,
  },
  picker: {
    height: 30,
    width: 150,
    fontSize: 12,
  },
  altitudeInputContainer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  inputWrapper: {
    marginVertical: 2,
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  altitudeInput: {
    width: 60,
    height: 30,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 12,
    marginHorizontal: 5,
    backgroundColor: '#fff',
  },
});