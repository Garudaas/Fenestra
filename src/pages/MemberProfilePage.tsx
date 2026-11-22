const handleSendCompletionRequest = async () => {
    if (!user || !member || incompleteItems.length === 0) return

    const { resolveOfficerDisplayName } = await import('@/lib/taskAuditService')
    const senderTitledName = await resolveOfficerDisplayName(user.id, user.full_name)

    const bulletList = incompleteItems.map(item => `• ${item.label}`).join('\n')
    const formattedMessage = `${senderTitledName} has requested you to complete the below details in your profile in the Fenestrians App:\n\n${bulletList}`

    const subItems = incompleteItems.map((item, idx) => ({
      id: `peer_${idx}_${item.targetKey}`,
      label: item.label,
      fieldKey: item.targetKey,
      preferenceType: item.preferenceType,
      completed: false,
      optedOut: false,
    }))

    setSendingRequest(true)
    try {
      const { data: createdTask } = await supabase
        .from('member_tasks')
        .insert([
          {
            assigned_to_user_id: member.id,
            assigned_by_user_id: user.id,
            task_type: 'peer_profile_request',
            field_key: incompleteItems.map(i => i.targetKey).join(','),
            title: `Profile Completion Request from ${senderTitledName}`,
            description: formattedMessage,
            is_micromanaged: false,
            status: 'pending',
            is_private: true,
            sender_display_name: senderTitledName,
            task_items_json: subItems,
          },
        ])
        .select('id')
        .single()

      await publishArchivedAlert({
        category: 'personal_task',
        shortTitle: 'Personal task alert',
        fullMessage: formattedMessage,
        targetUserId: member.id,
        metadata: {
          task_id: createdTask?.id,
          is_micromanaged: false,
          audit_items: incompleteItems,
        },
      })

      setLastRequestMessage(formattedMessage)
      setRequestSent(true)

      const cleanWa = cleanPhoneNumber(member.whatsapp_number)
      const hasEmail = Boolean(member.email && member.email.trim())

      if (cleanWa) {
        window.open(buildWhatsAppUrl(cleanWa, formattedMessage), '_blank', 'noopener,noreferrer')
      } else if (hasEmail) {
        window.location.href = buildMailtoUrl(member.email.trim(), formattedMessage)
      }
    } finally {
      setSendingRequest(false)
    }
  }
