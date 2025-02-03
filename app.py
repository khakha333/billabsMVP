import streamlit as st
from openai import OpenAI
import requests
from bs4 import BeautifulSoup
import time

st.title("공간지능 기반 숙소 검색")
client = OpenAI()

if "openai_model" not in st.session_state:
    st.session_state["openai_model"] = "gpt-4o-mini"
if "messages" not in st.session_state:
    st.session_state.messages = []
if "results" not in st.session_state:
    st.session_state.results = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# 크롤링(by GPT)
@st.cache_data(show_spinner=False)
def crawl_airbnb(location: str):
    """
    Airbnb 웹페이지를 크롤링하여 특정 위치의 숙소 정보를 반환합니다.
    ※ 실제 크롤링을 위해서는 동적 컨텐츠 처리(Selenium 등)가 필요하며,
      이 예제에서는 더미 데이터를 반환합니다.
    """
    # 더미 데이터 예시
    dummy_data = [
        {
            "title": "편안한 침실 아파트"
            "url": "https://www.airbnb.co.kr/rooms/12345",
            "image_url": "https://via.placeholder.com/300x200.png?text=숙소+1",
            "bed_count": None  # 이후 이미지 분석에서 채워질 예정
        },
        {
            "title": "도심 속 아늑한 숙소",
            "url": "https://www.airbnb.co.kr/rooms/67890",
            "image_url": "https://via.placeholder.com/300x200.png?text=숙소+2",
            "bed_count": None
        }
    ]
    # 실제 크롤링 예시 (단순 static HTML 파싱 – Airbnb는 실제로 동적 로딩을 사용하므로 참고용)
    # url = f"https://www.airbnb.co.kr/s/{location}/homes"
    # headers = {"User-Agent": "Mozilla/5.0 ..."}
    # res = requests.get(url, headers=headers)
    # soup = BeautifulSoup(res.text, "html.parser")
    # 크롤링 로직 추가...
    
    return dummy_data

# 수정 필요(현재 예시로 대체)
def analyze_image(image_url: str) -> dict:
    response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What's in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_url,
                    },
                },
            ],
        }
    ],
    max_tokens=300,
    )
    return response.choices[0].message

# 형식 맞춰서 수정 필요
def display_results(results: list):
    st.subheader("검색 결과")
    for result in results:
        st.markdown(f"**[{result['title']}]({result['url']})**")
        if result.get("image_url"):
            st.image(result["image_url"], width=300)
        st.write("침대 개수:", result.get("bed_count", "정보 없음"))
        st.markdown("---")



if prompt := st.chat_input("무엇을 도와드릴까요?"):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    
    with st.chat_message("assistant"):
        messages = [
            {"role": m["role"], "content": m["content"]}
            for m in st.session_state.messages
        ]
        stream = client.chat.completions.create(
            model=st.session_state["openai_model"],
            messages=messages,
            stream=True
        )
        response = st.write_stream(stream)
    st.session_state.messages.append({"role": "assistant", "content": response})
    
    if any(keyword in prompt for keyword in ["크롤링", "검색", "숙소"]):
        # 예시: 사용자 입력에서 위치 추출 (여기서는 간단하게 "서울"로 가정)
        location = "서울"
        st.info(f"{location} 위치의 숙소 정보를 크롤링 중입니다...")
        results = crawl_airbnb(location)
        
        st.info("각 숙소의 이미지를 분석하여 조건을 추출합니다...")
        for result in results:
            analysis = analyze_image(result["image_url"])
            result.update(analysis)
        
        st.session_state.results = results
        
        display_results(results)




