/* script.js */

// DOM要素を取得
const permissionButton = document.getElementById('permissionButton');
const statusDiv = document.getElementById('status');
const dataDiv = document.getElementById('data');
const resultDiv = document.getElementById('result');
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValueSpan = document.getElementById('thresholdValue');
const logList = document.getElementById('logList');

// 検知のしきい値 (振りの強さ)
let THRESHOLD = parseFloat(thresholdSlider.value);
let isDetecting = false;

// 重力加速度 (Z軸) を推定するための変数
let gravityZ = 0; 
// ローパスフィルタの係数 (0に近いほどゆっくり変化)
const ALPHA = 0.8; 
// センサーモード (A: 重力除く, G: 重力込み)
let sensorMode = 'Unknown'; 

// スライダーが操作されたら、しきい値(THRESHOLD)を更新
thresholdSlider.addEventListener('input', () => {
    THRESHOLD = parseFloat(thresholdSlider.value);
    // 画面の表示も更新 (小数点以下1桁)
    thresholdValueSpan.textContent = THRESHOLD.toFixed(1);
});

// 1. 許可ボタンのクリックイベント
permissionButton.addEventListener('click', () => {
    // (A) iOS 13以降の場合: DeviceMotionEvent.requestPermission() が存在する
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        
        DeviceMotionEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    // 許可された場合
                    startMotionDetection();
                } else {
                    // 許可されなかった場合
                    statusDiv.textContent = '加速度センサーの使用が許可されませんでした。';
                }
            })
            .catch(error => {
                // エラー処理
                statusDiv.textContent = '許可エラー: ' + error.message;
            });

    } else {
        // (B) Android または 古いiOSの場合: requestPermissionは不要
        startMotionDetection();
    }
});

// 2. 加速度センサーの監視を開始する関数
function startMotionDetection() {
    permissionButton.style.display = 'none';
    statusDiv.textContent = '監視中... 画面を上に向けて上に振ってください';
    window.addEventListener('devicemotion', handleMotionEvent);
}

// 3. 'devicemotion' イベントを処理する関数 (Z軸監視)
function handleMotionEvent(event) {
    
    let z_accel_raw = 0; // センサーから取得した生のZ軸加速度
    let z_accel = 0;     // 計算後の「振りの強さ」

    // --- センサーデータの取得とモード判定 ---
    
    // (A) iPhoneパターン: event.acceleration (重力除く) の「z」が利用可能な場合
    if (event.acceleration && typeof event.acceleration.z === 'number') { 
        
        if (sensorMode === 'Unknown') sensorMode = 'A (重力除く)';
        
        z_accel_raw = event.acceleration.z; 
        z_accel = z_accel_raw; // 重力除くデータなので、そのまま「振りの強さ」として使う
    
    // (B) Androidパターン: event.accelerationIncludingGravity (重力込み) の「z」しか使えない場合
    } else if (event.accelerationIncludingGravity && typeof event.accelerationIncludingGravity.z === 'number') { 
        
        if (sensorMode === 'Unknown') sensorMode = 'G (重力込み)';

        z_accel_raw = event.accelerationIncludingGravity.z; 
        
        // --- ローパスフィルタで重力成分を推定 ---
        // z_accel_raw (重力 + 振りの強さ) のうち、ゆっくり動く成分(gravityZ)を計算
        gravityZ = ALPHA * gravityZ + (1 - ALPHA) * z_accel_raw; 
        
        // 「振りの強さ」 = 「全体の加速度」 - 「重力成分」
        z_accel = z_accel_raw - gravityZ; 

    } else {
        // どちらも取れない場合
        statusDiv.textContent = '加速度センサーのデータを取得できません。';
        return;
    }

    // --- データ表示 ---
    // 画面には、計算後の「振りの強さ」を表示
    dataDiv.textContent = `Z加速度 (振りの強さ): ${z_accel.toFixed(2)}`; 
    
    // ステータス欄に、動作モードを表示 (初回のみ)
    if (statusDiv.textContent.startsWith('監視中...')) {
        statusDiv.textContent = `監視中 (モード: ${sensorMode})`;
    }

    // --- 検知判定 ---
    // 計算後の「振りの強さ」(z_accel) が スライダーのしきい値(THRESHOLD) を超えたか
    if (z_accel > THRESHOLD && !isDetecting) { 
        
        isDetecting = true;
        resultDiv.textContent = '検知！';
        document.body.classList.add('detected');

        // --- ログ追加処理 ---
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const logEntry = document.createElement('li');
        // ログにZ軸の値を記録
        logEntry.textContent = `[${timeString}] 検知: ${z_accel.toFixed(2)} (Raw: ${z_accel_raw.toFixed(2)}, Mode: ${sensorMode})`; 
        
        // リストの先頭に追加
        logList.prepend(logEntry);
        // ---

        console.log(`検知: ${z_accel.toFixed(2)} m/s^2`); 

        // 1秒後に表示をリセット
        setTimeout(() => {
            resultDiv.textContent = '';
            document.body.classList.remove('detected');
            isDetecting = false;
        }, 1000);
    }
}
