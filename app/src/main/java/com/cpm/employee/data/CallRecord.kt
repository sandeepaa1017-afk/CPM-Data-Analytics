package com.cpm.employee.data

data class CallRecord(
    val id: String,
    val phone: String,
    val type: CallType,
    val date: String,
    val time: String,
    val durationSeconds: Int,
    val status: String,
    val dateTimeMillis: Long
)

enum class CallType(val label: String) {
    INCOMING("Incoming"),
    OUTGOING("Outgoing"),
    MISSED("Missed"),
    REJECTED("Rejected")
}

enum class CallFilter(val label: String) {
    ALL("All"),
    INCOMING("Incoming"),
    OUTGOING("Outgoing"),
    MISSED("Missed"),
    REJECTED("Rejected")
}
