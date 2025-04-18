from django.db import models

class Artefact(models.Model):
    ARTEFACT_TYPES = [
        ('chart', 'Chart'),
        ('table', 'Table'),
    ]

    name = models.CharField(max_length=255)
    artefact_type = models.CharField(max_length=10, choices=ARTEFACT_TYPES)
    data = models.JSONField()  # Store chart/table data in JSON format
    code = models.TextField()  # Store associated code
    sheet_id = models.CharField(max_length=255)  # Store sheet ID
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.artefact_type})"