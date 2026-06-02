from __future__ import annotations

import os

import streamlit as st

from storage import connect, init_db
from ui.admin import render_admin_page
from ui.participant import render_participant_page
from ui.styles import inject_app_styles


ADMIN_PASSCODE = os.environ.get("CSI_ADMIN_PASSCODE", "csi-admin")


st.set_page_config(
    page_title="評価入力", layout="wide", initial_sidebar_state="collapsed"
)


@st.cache_resource
def get_connection():
    conn = connect()
    init_db(conn)
    return conn


def main() -> None:
    inject_app_styles()
    conn = get_connection()
    page = st.sidebar.radio(
        "ページ",
        ["参加者回答", "研究者画面"],
    )
    if page == "参加者回答":
        render_participant_page(conn)
    else:
        render_admin_page(conn, ADMIN_PASSCODE)


if __name__ == "__main__":
    main()
