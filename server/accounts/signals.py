from django.db.models.signals import post_save
from django.dispatch import receiver

from organisations.models import Organisation

from .models import User


@receiver(post_save, sender=User)
def create_default_organisation(sender, instance, created, **kwargs):
    if created:
        users_first_name = instance.name.split(" ")[0]
        Organisation.objects.create(
            name=f"{users_first_name}'s Organisation", owner=instance
        )
