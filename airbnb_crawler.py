import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

def crawl_airbnb_listings():
    # 크롬 드라이버 자동 설치/업데이트
    service = Service(ChromeDriverManager().install())
    options = webdriver.ChromeOptions()
    # 필요 시 headless 모드 사용 가능
    # options.add_argument('--headless') 

    driver = webdriver.Chrome(service=service, options=options)
    driver.implicitly_wait(10)

    # 1) Airbnb 검색 결과 페이지 접속
    url = ("https://www.airbnb.co.kr/s/%EA%B0%95%EB%A6%89/homes"
           "?refinement_paths%5B%5D=%2Fhomes"
           "&flexible_trip_lengths%5B%5D=one_week"
           "&monthly_start_date=2025-02-01"
           "&monthly_length=3&monthly_end_date=2025-05-01"
           "&price_filter_input_type=0"
           "&channel=EXPLORE"
           "&search_type=search_query"
           "&price_filter_num_nights=1"
           "&date_picker_type=calendar"
           "&checkin=2025-02-05"
           "&checkout=2025-02-06"
           "&source=structured_search_input_header"
           "&query=%EC%86%8D%EC%B4%88")
    driver.get(url)
    time.sleep(5)  # 페이지 로드 대기 (네트워크 상황에 따라 조절)

    # 2) 현재 페이지에 나열된 숙소(카드) 요소 수집
    #    Airbnb 사이트 구조 변경될 수 있으므로, CSS 셀렉터는 상황에 맞게 변경 필요
    listing_cards = driver.find_elements(By.CSS_SELECTOR, 'div[data-testid="property-card"]')
    print(f"Listing count: {len(listing_cards)}")

    listing_urls = []
    for card in listing_cards:
        try:
            # 숙소 상세 페이지 링크 찾기
            link_element = card.find_element(By.CSS_SELECTOR, 'a')
            listing_url = link_element.get_attribute('href')
            if listing_url and "rooms" in listing_url:
                listing_urls.append(listing_url)
        except:
            pass

    # 3) 각 숙소 상세 페이지로 이동하여 정보/이미지 추출
    results = []
    for i, detail_url in enumerate(listing_urls):
        print(f"\n[{i+1}/{len(listing_urls)}] 크롤링 중: {detail_url}")
        driver.get(detail_url)
        time.sleep(5)  # 상세 페이지 로드 대기

        # BeautifulSoup을 이용한 추가 파싱 (옵션)
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')

        # 예시1) 숙소 제목 추출
        # Airbnb는 종종 h1 태그 내에 숙소 제목을 넣지만, 구조가 바뀔 수 있으니 확인 필요
        title_element = soup.find('h1', {'data-testid': 'title'})
        title = title_element.get_text(strip=True) if title_element else '제목 없음'

        # 예시2) 호스트 정보, 숙소 설명, 편의시설, 평점 등
        # 실제 셀렉터나 속성명은 Airbnb 업데이트에 따라 달라질 수 있으므로 적절히 조정
        # 아래는 단순 예시
        try:
            description_element = soup.find('div', {'data-section-id': 'DESCRIPTION_DEFAULT'})
            description = description_element.get_text(strip=True) if description_element else ''
        except:
            description = ''

        # 예시3) 이미지 URL 수집
        # 대체로 <img> 태그 혹은 백그라운드 이미지(css)에서 추출
        image_elements = soup.find_all('img')
        image_urls = []
        for img in image_elements:
            src = img.get('src')
            if src and 'https://' in src:
                # 썸네일/프로필 사진 등이 섞여있을 수 있음
                # 필요한 조건(규격, 경로 등)에 따라 필터링 가능
                image_urls.append(src)

        # 수집 결과 저장
        listing_data = {
            'title': title,
            'description': description,
            'detail_url': detail_url,
            'image_urls': list(set(image_urls))  # 중복 제거
        }
        results.append(listing_data)

    driver.quit()
    return results

if __name__ == "__main__":
    data = crawl_airbnb_listings()
    print("\n=== 크롤링 완료 ===")
    for idx, item in enumerate(data, start=1):
        print(f"\n[{idx}] 숙소 제목: {item['title']}")
        print(f" - 상세 페이지: {item['detail_url']}")
        print(f" - 설명 (일부): {item['description'][:100]}...")
        print(f" - 이미지 URL 개수: {len(item['image_urls'])}")
