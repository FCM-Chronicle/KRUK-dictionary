// ==========================================
// 1. 데이터 및 상태 관리
// ==========================================

// 랜덤 검색을 위한 단어 목록
const randomWords = ['apple', 'love', 'computer', 'sky', 'dream', 'music', 'coffee', 'freedom', 'star', 'ocean'];

// ★★★ API 키 설정 (아래 따옴표 사이에 발급받은 인증키를 넣으세요) ★★★
const API_KEY = '79033507489179A982851392F0663259'; // 예: 'A1B2C3D4E5...'

// ==========================================
// 2. 사전 기능 (Dictionary Logic)
// ==========================================

const dictInput = document.getElementById('dict-input');
const resultArea = document.getElementById('search-result');

// 단어 검색 함수
async function searchWord(word) {
    if (!word) return;

    // UI 초기화
    resultArea.innerHTML = '<p style="color:#888;">검색 중...</p>';
    dictInput.value = word; // 입력창에도 표시

    // 영어 입력 감지 (영어 알파벳이 포함되어 있으면 원어 검색 모드로 전환)
    const isEnglish = /[a-zA-Z]/.test(word);
    let targetParam = "";
    if (isEnglish) {
        targetParam = "&target=4"; // target=4는 '원어' 검색
    }

    // API 호출 URL 생성 (한영사전 모드: translated=y, trans_lang=1)
    // HTTPS 프로토콜 사용, sort=popular(많이 찾은 순)
    const url = `https://krdict.korean.go.kr/api/search?key=${API_KEY}&q=${encodeURIComponent(word)}&translated=y&trans_lang=1&sort=popular&part=word&num=10&advanced=y${targetParam}`;

    try {
        // 1. API 데이터 가져오기
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        // 2. XML 텍스트로 변환
        const strXml = await response.text();

        // 3. XML 파싱 (Javascript DOMParser 사용)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(strXml, "text/xml");

        // 4. 결과 추출
        const items = xmlDoc.getElementsByTagName("item");

        if (items.length > 0) {
            // 첫 번째 검색 결과만 표시 (필요하면 반복문으로 여러 개 표시 가능)
            const item = items[0];
            
            // 단어 정보 추출
            const wordText = item.getElementsByTagName("word")[0]?.textContent || word;
            
            // 뜻풀이 및 번역 정보 추출 (sense 태그 내부)
            const sense = item.getElementsByTagName("sense")[0];
            const definition = sense?.getElementsByTagName("definition")[0]?.textContent || "뜻풀이가 없습니다.";
            
            // 영어 번역 추출 (translation 태그 내부)
            const translation = sense?.getElementsByTagName("translation")[0];
            const transWord = translation?.getElementsByTagName("trans_word")[0]?.textContent || "";
            const transDfn = translation?.getElementsByTagName("trans_dfn")[0]?.textContent || "";

            resultArea.innerHTML = `
                <div class="result-card">
                    <div class="word-header">
                        <span class="korean-word">${wordText}</span>
                        ${transWord ? `<span class="english-badge">${transWord}</span>` : ''}
                    </div>
                    <div class="word-mean">${definition}</div>
                    <div class="eng-mean-box">
                        <span class="eng-label">Meaning</span>
                        <span class="eng-text">${transDfn || "번역 정보 없음"}</span>
                    </div>
                </div>
            `;
        } else {
            // 한국어 기초사전에 없으면 다음(Daum) 사전 크롤링 시도
            await searchDaumCrawling(word);
        }
    } catch (error) {
        console.error(error);
        resultArea.innerHTML = `
            <div class="word-title">오류 발생</div>
            <div class="word-mean">
                사전 데이터를 불러오지 못했습니다.<br>
                <span style="font-size:0.8em; color:red;">${error.message}</span><br>
                <span style="font-size:0.8em; color:#888;">(API 키가 올바른지 확인해주세요)</span>
            </div>
        `;
    }
}

// 다음(Daum) 사전 크롤링 함수 (CORS 프록시 사용)
async function searchDaumCrawling(word) {
    // 1. CORS 우회를 위한 프록시 서버 URL (corsproxy.io로 변경)
    const proxyUrl = 'https://corsproxy.io/?';
    // 2. 다음 영어사전 검색 URL
    const targetUrl = 'https://dic.daum.net/search.do?q=' + encodeURIComponent(word);

    try {
        // 프록시를 통해 요청
        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        const html = await response.text();
        
        if (!html) throw new Error('No content');

        // 3. 가져온 HTML 텍스트를 DOM으로 파싱
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 4. 다음 사전 검색 결과에서 뜻 추출
        // .card_word 내의 .list_search li 요소가 검색 결과입니다.
        const firstResult = doc.querySelector('.card_word .list_search li');

        if (firstResult) {
            // 단어 텍스트 추출
            const wordText = firstResult.querySelector('.txt_search')?.textContent?.trim() || word;
            
            // 뜻풀이 추출 (여러 개의 뜻을 콤마로 연결)
            const meanList = firstResult.querySelectorAll('.list_mean li .txt_mean');
            let meaningText = "";
            if (meanList.length > 0) {
                meaningText = Array.from(meanList).map(el => el.textContent.trim()).join(', ');
            }

            resultArea.innerHTML = `
                <div class="result-card">
                    <div class="word-header">
                        <span class="korean-word">${wordText}</span>
                        <span class="english-badge">Daum</span>
                    </div>
                    ${meaningText ? `<div class="word-mean">${meaningText}</div>` : ''}
                </div>
            `;
        } else {
            // 검색 결과가 없는 경우
            resultArea.innerHTML = `
                <div class="word-title">${word}</div>
                <div class="word-mean">검색 결과가 없습니다.</div>
            `;
        }
    } catch (e) {
        console.error(e);
        resultArea.innerHTML = `
            <div class="word-title">${word}</div>
            <div class="word-mean">검색 결과가 없습니다.</div>
        `;
    }
}

// 검색 버튼 클릭
document.getElementById('dict-search-btn').addEventListener('click', () => {
    if (dictInput.value) searchWord(dictInput.value);
});

// 엔터키 처리
dictInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && dictInput.value) searchWord(dictInput.value);
});


// ==========================================
// 3. 메뉴 및 비밀 모드 진입 (Menu Logic)
// ==========================================

const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');

// 메뉴 열기
document.getElementById('menu-btn').addEventListener('click', () => {
    sideMenu.classList.add('open');
    menuOverlay.classList.add('open');
});

// 메뉴 닫기
function closeMenu() {
    sideMenu.classList.remove('open');
    menuOverlay.classList.remove('open');
}
document.getElementById('close-menu-btn').addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', closeMenu);

// ★ 비밀 트리거 버튼 클릭 ★
document.getElementById('secret-trigger-btn').addEventListener('click', () => {
    // 1. 메뉴 닫기
    closeMenu();

    // 2. 약간의 딜레이 후 코드 입력창 띄우기
    setTimeout(() => {
        const code = prompt("쿠폰 코드를 입력하세요:");
        
        if (code === "tearkite") {
            activateLauncherMode();
        } else if (code !== null) {
            alert("유효하지 않은 코드입니다.");
        }
    }, 100);
});


// ==========================================
// 4. 화면 전환 로직 (Switching Logic)
// ==========================================

const dictView = document.getElementById('dictionary-view');
const launcherView = document.getElementById('launcher-view');

function activateLauncherMode() {
    // 사전 숨기기
    dictView.classList.add('hidden');
    
    // 런처 보이기 (display:none 해제 후 opacity 조정)
    launcherView.classList.remove('hidden');
    launcherView.style.opacity = 0;
    
    setTimeout(() => {
        launcherView.style.opacity = 1;
    }, 50);
}

function deactivateLauncherMode() {
    // 런처 숨기기
    launcherView.style.opacity = 0;
    
    setTimeout(() => {
        launcherView.classList.add('hidden');
        
        // 사전 보이기
        dictView.classList.remove('hidden');
        
        // ★ 복귀 시 랜덤 단어 검색 ★
        const randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
        searchWord(randomWord);

    }, 300); // transition 시간과 맞춤
}


// ==========================================
// 5. 런처 기능 (Launcher Logic)
// ==========================================

// URL 이동
function navigateTo(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    window.location.href = url;
}

// 런처 검색 버튼
document.getElementById('url-go-btn').addEventListener('click', () => {
    const val = document.getElementById('url-input').value;
    if (val) navigateTo(val);
});

// 런처 닫기 (X) 버튼 -> 사전으로 복귀
document.getElementById('launcher-close-btn').addEventListener('click', () => {
    deactivateLauncherMode();
});
