from __future__ import annotations

import sqlite3

import streamlit as st

from storage import (
    condition_summary,
    condition_summary_csv,
    delete_response,
    factor_data_csv,
    factor_summary,
    item_data_csv,
    list_experiment_conditions,
    pair_data_csv,
    participant_completion_summary,
    raw_data_csv,
    response_rows,
)


def render_admin_page(conn: sqlite3.Connection, admin_passcode: str) -> None:
    st.title("研究者画面")
    passcode = st.text_input("パスコード", type="password")
    if passcode != admin_passcode:
        st.warning("研究者画面を表示するにはパスコードを入力してください。")
        return

    st.caption("このアプリの総合点は6因子版CSI（Collaboration項目N/A）です。")

    conditions = list_experiment_conditions(conn)
    st.subheader("条件一覧")
    st.dataframe([dict(row) for row in conditions], use_container_width=True)

    summaries = [dict(row) for row in condition_summary(conn)]

    responses = [dict(row) for row in response_rows(conn)]
    st.subheader("削除操作")
    with st.expander("単一の回答を削除"):
        if not responses:
            st.info("削除できる回答はありません。")
        else:
            response_labels = {
                (
                    f"回答ID {row['id']} / {row['participant_id']} / "
                    f"{row['condition_name']} / {row['submitted_at']}"
                ): row
                for row in responses
            }
            with st.form("delete_response"):
                selected_label = st.selectbox("削除する回答", list(response_labels.keys()))
                delete_passcode = st.text_input("削除用パスコード", type="password", key="delete_response_passcode")
                submitted = st.form_submit_button("回答を削除")
                if submitted:
                    if delete_passcode != admin_passcode:
                        st.error("パスコードが正しくありません。")
                    else:
                        selected = response_labels[selected_label]
                        deleted = delete_response(conn, int(selected["id"]))
                        if deleted:
                            st.success("回答を削除しました。")
                            st.rerun()
                        else:
                            st.warning("指定された回答は見つかりませんでした。")

    st.subheader("参加者別完了状況")
    st.dataframe(participant_completion_summary(conn), use_container_width=True)

    st.subheader("条件別集計")
    st.dataframe(summaries, use_container_width=True)

    st.subheader("因子別集計")
    st.dataframe(factor_summary(conn), use_container_width=True)

    st.subheader("CSV出力")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.download_button("ローデータCSV", raw_data_csv(conn), "csi_raw_data.csv", "text/csv")
        st.download_button("項目別CSV", item_data_csv(conn), "csi_item_data.csv", "text/csv")
    with col2:
        st.download_button("因子別CSV", factor_data_csv(conn), "csi_factor_data.csv", "text/csv")
        st.download_button("ペア比較CSV", pair_data_csv(conn), "csi_pair_data.csv", "text/csv")
    with col3:
        st.download_button(
            "条件別集計CSV",
            condition_summary_csv(conn),
            "csi_condition_summary.csv",
            "text/csv",
        )
