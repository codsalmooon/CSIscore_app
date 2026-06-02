from __future__ import annotations

import sqlite3

import streamlit as st

from csi import PAIR_COMPARISONS, calculate_scores
from state import ensure_pair_order, reset_response_state
from storage import EXPERIMENT_CONDITION_NAMES, save_response


def finalize_response(conn: sqlite3.Connection) -> int:
    pair_order = ensure_pair_order()
    pair_choices = [
        st.session_state.csi_pair_choices[index]
        for index in range(len(PAIR_COMPARISONS))
    ]
    scores = calculate_scores(
        st.session_state.csi_item_scores,
        pair_choices,
        pair_order=pair_order,
    )
    response_id = save_response(
        conn=conn,
        participant_id=st.session_state.participant_id,
        condition_id=st.session_state.csi_condition_id,
        item_scores=st.session_state.csi_item_scores,
        pair_choices=pair_choices,
        pair_order=pair_order,
        scores=scores,
    )
    st.session_state.last_response_id = response_id
    completed_ids = set(st.session_state.csi_completed_condition_ids)
    completed_ids.add(st.session_state.csi_condition_id)
    reset_response_state()
    st.session_state.csi_completed_condition_ids = list(completed_ids)
    if len(completed_ids) >= len(EXPERIMENT_CONDITION_NAMES):
        st.session_state.csi_step = len(PAIR_COMPARISONS) + 2
    else:
        st.session_state.csi_step = 0
    return response_id
