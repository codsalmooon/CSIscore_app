from __future__ import annotations

import streamlit as st


def inject_app_styles() -> None:
    st.markdown(
        """
        <style>
        .block-container {
            max-width: 960px;
            padding-left: 1rem;
            padding-right: 1rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def inject_slider_styles() -> None:
    st.markdown(
        """
        <style>
        .csi-item-question {
            width: 960px;
            max-width: 100%;
            margin: 3rem auto 0.95rem;
            font-weight: 600;
            line-height: 1.5;
            text-align: left;
        }
        .csi-na-caption {
            width: 960px;
            max-width: 100%;
            margin: 0.15rem auto 0;
            color: rgba(49, 51, 63, 0.72);
            font-size: 0.875rem;
            text-align: left;
        }
        .stSlider {
            width: 640px !important;
            max-width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            --primary-color: #111111;
            --primary-color-hover: #111111;
        }
        .csi-item-question + div[data-testid="stHorizontalBlock"] {
            width: 960px;
            max-width: 100%;
            margin: 0 auto 0.35rem;
            align-items: center;
        }
        .csi-item-submit-row {
            width: 100%;
            padding-top: 2.75rem;
        }
        .csi-side-label {
            color: rgba(49, 51, 63, 0.72);
            font-size: 0.875rem;
            line-height: 1.25;
            white-space: nowrap;
        }
        .csi-side-label.left {
            text-align: right;
        }
        .csi-side-label.right {
            text-align: left;
        }
        div[data-testid="stTickBar"] {
            display: none;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def inject_pair_styles() -> None:
    st.markdown(
        """
        <style>
        div[data-testid="column"]:has(.csi-pair-button-marker) button {
            min-height: 11rem;
            width: 100%;
            padding: 1.5rem;
            border: 1px solid rgba(49, 51, 63, 0.22);
            border-radius: 8px;
            background: #ffffff;
            color: #111111;
            white-space: pre-wrap;
            font-size: 1.02rem;
            font-weight: 600;
            line-height: 1.45;
            text-align: center;
        }
        div[data-testid="column"]:has(.csi-pair-button-marker) button:hover {
            border-color: #111111;
            color: #111111;
        }
        div[data-testid="column"]:has(.csi-pair-button-marker.selected) button {
            border: 4px solid #111111 !important;
            background: #111111 !important;
            color: #ffffff !important;
            box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.14) !important;
        }
        div[data-testid="column"]:has(.csi-pair-button-marker.selected) button:hover {
            background: #111111 !important;
            color: #ffffff !important;
            border-color: #111111 !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
