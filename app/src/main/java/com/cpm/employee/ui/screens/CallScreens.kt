package com.cpm.employee.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.cpm.employee.data.CallFilter
import com.cpm.employee.data.CallRecord
import com.cpm.employee.data.CallType
import com.cpm.employee.navigation.EmployeeRoutes
import com.cpm.employee.ui.components.EmployeeScaffold
import com.cpm.employee.ui.components.EmptyState
import com.cpm.employee.ui.components.IconBadge
import com.cpm.employee.ui.components.LabelValueRow
import com.cpm.employee.ui.components.SectionTitle
import com.cpm.employee.ui.components.SurfaceCard
import com.cpm.employee.ui.theme.BrandCyan
import com.cpm.employee.ui.theme.BrandNavy
import com.cpm.employee.ui.theme.Error
import com.cpm.employee.ui.theme.PaleBlue
import com.cpm.employee.ui.theme.Success
import com.cpm.employee.ui.theme.TextPrimary
import com.cpm.employee.ui.theme.TextSecondary

@Composable
fun CallHistoryScreen(
    calls: List<CallRecord>,
    filter: CallFilter,
    searchQuery: String,
    onFilterChanged: (CallFilter) -> Unit,
    onSearchChanged: (String) -> Unit,
    onCallSelected: (String) -> Unit,
    navController: NavHostController
) {
    val visibleCalls = calls.filter { call ->
        val filterMatches = filter == CallFilter.ALL || call.type.name == filter.name
        val queryMatches = searchQuery.isBlank() ||
            call.phone.contains(searchQuery, ignoreCase = true)
        filterMatches && queryMatches
    }

    EmployeeScaffold(
        title = "Call history",
        navController = navController,
        selectedRoute = EmployeeRoutes.CALLS
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 22.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchChanged,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search name or phone") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = Color.White,
                        focusedContainerColor = Color.White,
                        focusedBorderColor = BrandNavy
                    )
                )
            }
            item {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CallFilter.entries.forEach { option ->
                        FilterChip(
                            selected = filter == option,
                            onClick = { onFilterChanged(option) },
                            label = { Text(option.label) },
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    SectionTitle("Recent activity", modifier = Modifier.padding(bottom = 0.dp))
                    Text("${visibleCalls.size} calls", color = TextSecondary, style = MaterialTheme.typography.labelMedium)
                }
            }
            if (visibleCalls.isEmpty()) {
                item {
                    EmptyState(
                        title = "No calls found",
                        message = "No device call records match your search or filters."
                    )
                }
            } else {
                items(visibleCalls, key = { it.id }) { call ->
                    CallRow(call = call) { onCallSelected(call.id) }
                }
            }
        }
    }
}

@Composable
private fun CallRow(call: CallRecord, onClick: () -> Unit) {
    val tint = callTypeColor(call.type)
    SurfaceCard(modifier = Modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconBadge(
                icon = callTypeIcon(call.type),
                tint = tint,
                background = tint.copy(alpha = 0.1f),
                size = 42
            )
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(call.phone, color = TextPrimary, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(3.dp))
                Text(call.phone, color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                Text("${call.type.label} · ${call.date}, ${call.time}", color = TextSecondary, style = MaterialTheme.typography.labelSmall)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(formatDuration(call.durationSeconds), color = TextPrimary, style = MaterialTheme.typography.labelMedium)
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "View call details", tint = TextSecondary)
            }
        }
    }
}

@Composable
fun CallDetailsScreen(
    call: CallRecord?,
    navController: NavHostController
) {
    EmployeeScaffold(
        title = "Call details",
        navController = navController,
        selectedRoute = null,
        showBottomBar = false,
        onBack = { navController.popBackStack() }
    ) { padding ->
        if (call == null) {
            Column(modifier = Modifier.padding(padding).padding(horizontal = 20.dp)) {
                EmptyState("Call not found", "This call is no longer available in the call history.")
            }
        } else {
            LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    SurfaceCard {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(22.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            IconBadge(
                                icon = callTypeIcon(call.type),
                                tint = callTypeColor(call.type),
                                background = callTypeColor(call.type).copy(alpha = 0.1f),
                                size = 58
                            )
                            Spacer(Modifier.height(14.dp))
                            Text(call.phone, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text("Call record", modifier = Modifier.padding(top = 4.dp), color = TextSecondary)
                        }
                    }
                }
                item {
                    SectionTitle("Call information")
                    SurfaceCard {
                        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                            LabelValueRow("Call type", call.type.label)
                            LabelValueRow("Date", call.date)
                            LabelValueRow("Time", call.time)
                            LabelValueRow("Duration", formatDuration(call.durationSeconds))
                            LabelValueRow(
                                "Status",
                                call.status.replaceFirstChar { it.uppercase() }
                            )
                        }
                    }
                }
                item {
                    SurfaceCard {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconBadge(Icons.Default.Phone, BrandCyan, PaleBlue)
                            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                                Text("Call record", fontWeight = FontWeight.SemiBold)
                                Text("Call activity · read from this device", color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun callTypeIcon(type: CallType) = when (type) {
    CallType.INCOMING -> Icons.Default.Call
    CallType.OUTGOING -> Icons.Default.Call
    CallType.MISSED -> Icons.Default.Call
    CallType.REJECTED -> Icons.Default.Call
}

private fun callTypeColor(type: CallType) = when (type) {
    CallType.INCOMING -> BrandCyan
    CallType.OUTGOING -> Success
    CallType.MISSED -> Error
    CallType.REJECTED -> Error
}

private fun formatDuration(totalSeconds: Int): String {
    if (totalSeconds <= 0) return "—"
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return if (minutes > 0) "${minutes}m ${seconds}s" else "${seconds}s"
}
